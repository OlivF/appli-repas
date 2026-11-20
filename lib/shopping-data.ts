import { redirect } from "next/navigation";
import { loadHousehold } from "@/lib/data";
import { availableStock, fridgeSignature, type FridgeItem, type FridgeStock } from "@/lib/fridge";
import { fridgeItems, openReservations } from "@/lib/fridge-data";
import { settleFinishedWeeks } from "@/lib/fridge-settlement";
import { loadMenuRecipes } from "@/lib/menu-recipes";
import type { PortionMember } from "@/lib/portions";
import { knownIngredients } from "@/lib/recipes-data";
import { defaultShoppingWeek } from "@/lib/shopping-items";
import {
  buildShoppingList,
  menuSignature,
  mergeShoppingItems,
  type Amount,
  type ShoppingMeal,
  type ShoppingSource,
  type ShoppingUnit,
  type StoredItem,
} from "@/lib/shopping";
import type { Database } from "@/lib/supabase/database.types";
import { parseWeekParam, todayInParis, weekLabel, weekRelation } from "@/lib/week";

type Client = Awaited<ReturnType<typeof loadHousehold>>["supabase"];
type ItemRow = Database["public"]["Tables"]["shopping_items"]["Row"];

// Un article de la liste, tel que l'écran le reçoit.
export type ListItem = StoredItem & { id: string };

// Ce que l'écran sait d'un ingrédient de la liste : son unité d'achat (« 200 g au frigo ») et sa
// durée de conservation (la date limite proposée en rangeant les courses).
export type ListIngredient = { unit: ShoppingUnit; shelfLifeDays: number | null };

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
    .select(
      "id, planned_meals(day, meal_type, recipe_id, member_ids), shopping_lists(id, menu_signature, fridge_signature, stored_at, settled_at)",
    )
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const meals: ShoppingMeal[] = plan?.planned_meals ?? [];
  const list = plan?.shopping_lists ?? null;
  return { planId: plan?.id ?? null, meals, list: Array.isArray(list) ? (list[0] ?? null) : list };
}

async function listItems(supabase: Client, listId: string): Promise<ListItem[]> {
  const { data, error } = await supabase.from("shopping_items").select(ITEM_COLUMNS).eq("list_id", listId).order("position");
  if (error) throw new Error(error.message);
  return data.map(toListItem);
}

// Ce que le frigo peut donner à cette liste : le stock libre (pas périmé avant son lundi) moins ce
// que les autres listes pas encore soldées ont déjà pris.
async function fridgeFor(supabase: Client, householdId: string, listId: string | null, weekStart: string) {
  const [items, reservations] = await Promise.all([fridgeItems(supabase, householdId), openReservations(supabase, householdId)]);
  return { items, stock: availableStock({ items, reservations, listId, weekStart }) };
}

// Les ingrédients du menu dans la liste : ceux dont la signature du frigo tient compte.
function menuIngredientIds(items: readonly Pick<StoredItem, "ingredient_id" | "pantry" | "manual">[]) {
  return items.flatMap((item) => (item.ingredient_id && !item.pantry && !item.manual ? [item.ingredient_id] : []));
}

// Recalcule la liste depuis le menu et le frigo, et l'enregistre en gardant ce qui y était déjà
// (cases cochées, « J'en ai déjà », placard passé dans la liste, « déjà rangé », articles
// manuels). Les articles enregistrés sont relus juste avant : une case cochée sur l'autre
// téléphone n'est pas perdue. La liste réserve ce qu'elle prend au frigo (from_fridge).
export async function syncShoppingList(
  supabase: Client,
  householdId: string,
  members: PortionMember[],
  weekStart: string,
  menu: Awaited<ReturnType<typeof loadWeekMenu>>,
): Promise<{ listId: string; items: ListItem[] } | null> {
  if (!menu.planId) return null;
  const [{ recipes, ingredients }, previous, fridge] = await Promise.all([
    loadMenuRecipes(supabase, menu.meals),
    menu.list ? listItems(supabase, menu.list.id) : Promise.resolve([]),
    fridgeFor(supabase, householdId, menu.list?.id ?? null, weekStart),
  ]);
  const computed = buildShoppingList({
    meals: menu.meals,
    recipes,
    members,
    ingredients,
    weekStart,
    stock: fridge.stock.stock,
    maybeInFridge: fridge.stock.maybe,
  });
  const merged = mergeShoppingItems(previous, computed);
  const { data: listId, error } = await supabase.rpc("sync_shopping_list", {
    target_week_plan_id: menu.planId,
    signature: menuSignature(menu.meals),
    fridge: fridgeSignature(fridge.stock, menuIngredientIds(merged)),
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

// Unité d'achat et conservation des ingrédients de la liste.
async function listIngredients(supabase: Client, items: readonly ListItem[]): Promise<Record<string, ListIngredient>> {
  const ids = [...new Set(items.flatMap((item) => (item.ingredient_id ? [item.ingredient_id] : [])))];
  if (ids.length === 0) return {};
  const { data, error } = await supabase.from("ingredients").select("id, shopping_unit, shelf_life_days").in("id", ids);
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.map((row) => [row.id, { unit: row.shopping_unit, shelfLifeDays: row.shelf_life_days }]));
}

// La date limite la plus proche des articles libres de chaque ingrédient (« Pour quoi ? »), parmi
// ceux qui comptent pour la semaine (pas périmés avant son lundi, comme le stock).
function nearestDates(items: readonly FridgeItem[], weekStart: string): Record<string, string> {
  const dates: Record<string, string> = {};
  for (const item of items) {
    if (item.reserved_list_id !== null || !item.ingredient_id || !item.best_before || item.best_before < weekStart) continue;
    const current = dates[item.ingredient_id];
    if (!current || item.best_before < current) dates[item.ingredient_id] = item.best_before;
  }
  return dates;
}

export type Outdated = "menu" | "fridge" | null;

// Tout ce que l'écran /courses affiche. D'abord le bilan des semaines finies. À la première
// ouverture d'une semaine qui a un menu, la liste se crée ; ensuite, `outdated` dit seulement que
// le menu, ou le frigo, a changé : jamais de mise à jour automatique.
export async function loadShopping(weekParam?: string) {
  const { supabase, household, members } = await loadShoppingHousehold();
  const today = todayInParis();
  await settleFinishedWeeks(supabase, household.id, today);
  const weekStart = weekParam
    ? parseWeekParam(weekParam, today)
    : await defaultShoppingWeek(today, async (week) => (await loadWeekMenu(supabase, household.id, week)).meals.length > 0);

  const [menu, known] = await Promise.all([loadWeekMenu(supabase, household.id, weekStart), knownIngredients(supabase)]);
  let listId = menu.list?.id ?? null;
  let items: ListItem[] = [];
  let outdated: Outdated = null;
  let fridge: { items: FridgeItem[]; stock: FridgeStock } | null = null;

  if (menu.list) {
    [items, fridge] = await Promise.all([listItems(supabase, menu.list.id), fridgeFor(supabase, household.id, menu.list.id, weekStart)]);
    if (menu.list.menu_signature !== menuSignature(menu.meals)) outdated = "menu";
    // Une semaine soldée ne compte plus sur le frigo.
    else if (!menu.list.settled_at && menu.list.fridge_signature !== fridgeSignature(fridge.stock, menuIngredientIds(items))) {
      outdated = "fridge";
    }
  } else if (menu.meals.length > 0) {
    const created = await syncShoppingList(supabase, household.id, members, weekStart, menu);
    listId = created?.listId ?? null;
    items = created?.items ?? [];
  }

  const [ingredients, fridgeRows] = await Promise.all([
    listIngredients(supabase, items),
    fridge ? Promise.resolve(fridge.items) : fridgeItems(supabase, household.id),
  ]);

  return {
    today,
    weekStart,
    label: weekLabel(weekStart),
    relation: weekRelation(weekStart, today),
    hasMenu: menu.meals.length > 0,
    listId,
    storedAt: menu.list?.stored_at ?? null,
    settledAt: menu.list?.settled_at ?? null,
    outdated,
    items,
    known,
    ingredients,
    fridgeDates: nearestDates(fridgeRows, weekStart),
  };
}
