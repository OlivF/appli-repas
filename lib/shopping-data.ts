import { redirect } from "next/navigation";
import { loadHousehold } from "@/lib/data";
import type { PortionMember } from "@/lib/portions";
import { knownIngredients } from "@/lib/recipes-data";
import { defaultShoppingWeek } from "@/lib/shopping-items";
import {
  buildShoppingList,
  menuSignature,
  mergeShoppingItems,
  type Amount,
  type ShoppingIngredient,
  type ShoppingMeal,
  type ShoppingRecipe,
  type ShoppingSource,
  type StoredItem,
} from "@/lib/shopping";
import type { Database } from "@/lib/supabase/database.types";
import { parseWeekParam, todayInParis, weekLabel, weekRelation } from "@/lib/week";

type Client = Awaited<ReturnType<typeof loadHousehold>>["supabase"];
type ItemRow = Database["public"]["Tables"]["shopping_items"]["Row"];

// Un article de la liste, tel que l'écran le reçoit.
export type ListItem = StoredItem & { id: string };

export const ITEM_COLUMNS =
  "id, ingredient_id, label, amounts, aisle, pantry, sources, checked, removed, needed, quantity_changed, manual, quantity_text, position, from_fridge, maybe_in_fridge, stored";

export function toListItem(row: Pick<ItemRow, keyof ListItem>): ListItem {
  return {
    ...row,
    amounts: row.amounts as Amount[],
    sources: row.sources as ShoppingSource[],
    from_fridge: Number(row.from_fridge),
  };
}

// Foyer terminé, avec ce qu'il faut pour les portions (année de naissance, appétit).
export async function loadShoppingHousehold() {
  const { supabase, household, members, step } = await loadHousehold();
  if (step !== null || !household) redirect(step ?? "/bienvenue");
  const portionMembers: PortionMember[] = members.map(({ id, birth_year, appetite }) => ({ id, birth_year, appetite }));
  return { supabase, household, members: portionMembers };
}

// La semaine et ses plats (sans les recettes) : de quoi savoir si la liste est à jour.
export async function loadWeekMenu(supabase: Client, householdId: string, weekStart: string) {
  const { data: plan, error } = await supabase
    .from("week_plans")
    .select("id, planned_meals(day, meal_type, recipe_id, member_ids), shopping_lists(id, menu_signature)")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const meals: ShoppingMeal[] = plan?.planned_meals ?? [];
  const list = plan?.shopping_lists ?? null;
  return { planId: plan?.id ?? null, meals, list: Array.isArray(list) ? (list[0] ?? null) : list };
}

// La liste calculée depuis les plats : recettes, lignes et ingrédients canoniques.
async function computeItems(supabase: Client, meals: ShoppingMeal[], members: PortionMember[], weekStart: string) {
  const recipeIds = [...new Set(meals.map((meal) => meal.recipe_id))];
  if (recipeIds.length === 0) return [];
  const { data: recipeRows, error } = await supabase
    .from("recipes")
    .select("id, title, servings, recipe_ingredients(ingredient_id, name, quantity, unit, aisle)")
    .in("id", recipeIds);
  if (error) throw new Error(error.message);
  const recipes: ShoppingRecipe[] = recipeRows.map(({ recipe_ingredients, ...recipe }) => ({ ...recipe, ingredients: recipe_ingredients }));

  const ingredientIds = [
    ...new Set(recipes.flatMap((recipe) => recipe.ingredients.map((line) => line.ingredient_id)).filter((id) => id !== null)),
  ];
  const { data: ingredients, error: ingredientsError } = ingredientIds.length
    ? await supabase
        .from("ingredients")
        .select("id, name, aisle, shopping_unit, piece_grams, grams_per_ml, pantry")
        .in("id", ingredientIds)
    : { data: [] as ShoppingIngredient[], error: null };
  if (ingredientsError) throw new Error(ingredientsError.message);

  return buildShoppingList({ meals, recipes, members, ingredients, weekStart });
}

async function listItems(supabase: Client, listId: string): Promise<ListItem[]> {
  const { data, error } = await supabase.from("shopping_items").select(ITEM_COLUMNS).eq("list_id", listId).order("position");
  if (error) throw new Error(error.message);
  return data.map(toListItem);
}

// Recalcule la liste depuis le menu et l'enregistre, en gardant ce qui y était déjà (cases
// cochées, « J'en ai déjà », placard passé dans la liste, articles manuels). Les articles
// enregistrés sont relus juste avant : une case cochée sur l'autre téléphone n'est pas perdue.
export async function syncShoppingList(
  supabase: Client,
  members: PortionMember[],
  weekStart: string,
  menu: Awaited<ReturnType<typeof loadWeekMenu>>,
): Promise<{ listId: string; items: ListItem[] } | null> {
  if (!menu.planId) return null;
  const [computed, previous] = await Promise.all([
    computeItems(supabase, menu.meals, members, weekStart),
    menu.list ? listItems(supabase, menu.list.id) : Promise.resolve([]),
  ]);
  const merged = mergeShoppingItems(previous, computed);
  const { data: listId, error } = await supabase.rpc("sync_shopping_list", {
    target_week_plan_id: menu.planId,
    signature: menuSignature(menu.meals),
    // Le frigo arrive avec l'étape C.
    fridge: "",
    items: merged.map((item) => ({
      ingredient_id: item.ingredient_id,
      label: item.label,
      amounts: item.amounts,
      aisle: item.aisle,
      pantry: item.pantry,
      sources: item.sources,
      checked: item.checked,
      removed: item.removed,
      needed: item.needed,
      quantity_changed: item.quantity_changed,
      position: item.position,
      from_fridge: item.from_fridge,
      maybe_in_fridge: item.maybe_in_fridge,
      stored: item.stored,
    })),
  });
  if (error || !listId) throw new Error(error?.message ?? "Liste non enregistrée");
  return { listId, items: await listItems(supabase, listId) };
}

// Tout ce que l'écran /courses affiche. À la première ouverture d'une semaine qui a un menu, la
// liste se crée ; ensuite, `outdated` dit seulement que le menu a changé.
export async function loadShopping(weekParam?: string) {
  const { supabase, household, members } = await loadShoppingHousehold();
  const today = todayInParis();
  const weekStart = weekParam
    ? parseWeekParam(weekParam, today)
    : await defaultShoppingWeek(today, async (week) => (await loadWeekMenu(supabase, household.id, week)).meals.length > 0);

  const [menu, known] = await Promise.all([loadWeekMenu(supabase, household.id, weekStart), knownIngredients(supabase)]);
  let listId = menu.list?.id ?? null;
  let items: ListItem[] = [];

  if (menu.list) {
    items = await listItems(supabase, menu.list.id);
  } else if (menu.meals.length > 0) {
    const created = await syncShoppingList(supabase, members, weekStart, menu);
    listId = created?.listId ?? null;
    items = created?.items ?? [];
  }

  return {
    weekStart,
    label: weekLabel(weekStart),
    relation: weekRelation(weekStart, today),
    hasMenu: menu.meals.length > 0,
    listId,
    outdated: Boolean(menu.list) && menu.list?.menu_signature !== menuSignature(menu.meals),
    items,
    known,
  };
}
