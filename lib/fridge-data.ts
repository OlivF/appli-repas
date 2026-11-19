import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loadHousehold } from "@/lib/data";
import { SOON_DAYS, fridgeForMenu, type FridgeItem, type MenuFridgeEntry } from "@/lib/fridge";
import { isUrgent, type FridgeIngredient } from "@/lib/fridge-items";
import { settleFinishedWeeks } from "@/lib/fridge-settlement";
import type { PortionMember } from "@/lib/portions";
import type { GroceryAisle } from "@/lib/recipes";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayInParis } from "@/lib/week";

type Client = Awaited<ReturnType<typeof createClient>>;
type FridgeRow = Database["public"]["Tables"]["fridge_items"]["Row"];

export const FRIDGE_COLUMNS = "id, ingredient_id, label, quantity, unit, best_before, origin, recipe_id, reserved_list_id";

// numeric arrive parfois en texte : toujours un nombre côté appli.
export function toFridgeItem(row: Pick<FridgeRow, keyof FridgeItem>): FridgeItem {
  return { ...row, quantity: row.quantity === null ? null : Number(row.quantity) };
}

export async function fridgeItems(supabase: Client, householdId: string): Promise<FridgeItem[]> {
  const { data, error } = await supabase.from("fridge_items").select(FRIDGE_COLUMNS).eq("household_id", householdId);
  if (error) throw new Error(error.message);
  return data.map(toFridgeItem);
}

// Le lundi de chaque liste : de quoi dire « pour la semaine du 23 nov. » et savoir quand finit
// la semaine d'un article réservé.
export async function listWeeks(supabase: Client, listIds: readonly string[]): Promise<Record<string, string>> {
  const ids = [...new Set(listIds)];
  if (ids.length === 0) return {};
  const { data, error } = await supabase.from("shopping_lists").select("id, week_plans(week_start)").in("id", ids);
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    data.flatMap((list) => {
      const plan = Array.isArray(list.week_plans) ? list.week_plans[0] : list.week_plans;
      return plan ? [[list.id, plan.week_start]] : [];
    }),
  );
}

const reservedIds = (items: readonly FridgeItem[]) =>
  items.flatMap((item) => (item.reserved_list_id ? [item.reserved_list_id] : []));

// Le référentiel (commun et foyer) : un ingrédient par clé, celui du foyer d'abord ; et le rayon
// de chaque ingrédient (y compris ceux qu'un ingrédient du foyer cache).
export async function fridgeIngredients(supabase: Client) {
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, name_key, aliases, aisle, shopping_unit, shelf_life_days, household_id")
    .order("name");
  if (error) throw new Error(error.message);
  const aisles: Record<string, GroceryAisle> = {};
  const byKey = new Map<string, FridgeIngredient>();
  const householdFirst = [...data].sort((a, b) => Number(a.household_id === null) - Number(b.household_id === null));
  for (const { id, name, name_key, aliases, aisle, shopping_unit, shelf_life_days } of householdFirst) {
    aisles[id] = aisle;
    // Colonne générée : jamais vide en pratique (le nom est obligatoire).
    const key = name_key ?? "";
    if (!byKey.has(key)) byKey.set(key, { id, name, name_key: key, aliases, aisle, shopping_unit, shelf_life_days });
  }
  return { ingredients: [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "fr")), aisles };
}

// Le dernier bilan des 7 derniers jours, à montrer sur /frigo tant qu'on ne l'a pas fermé.
async function recentSettlement(supabase: Client, householdId: string, today: string) {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("id, settled_at, week_plans(week_start)")
    .eq("household_id", householdId)
    .gte("settled_at", `${addDays(today, -7)}T00:00:00Z`)
    .order("settled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const plan = data && (Array.isArray(data.week_plans) ? data.week_plans[0] : data.week_plans);
  return data && plan ? { listId: data.id, weekStart: plan.week_start } : null;
}

// Foyer terminé, avec ce qu'il faut pour les portions (le bilan met les plats à l'échelle).
export async function loadFridgeHousehold() {
  const { supabase, household, members, step } = await loadHousehold();
  if (step !== null || !household) redirect(step ?? "/bienvenue");
  const portionMembers: PortionMember[] = members.map(({ id, birth_year, appetite }) => ({ id, birth_year, appetite }));
  return { supabase, household, members: portionMembers };
}

// Tout ce que l'écran /frigo affiche. D'abord le bilan des semaines finies.
export async function loadFridge() {
  const { supabase, household, members } = await loadFridgeHousehold();
  const today = todayInParis();
  await settleFinishedWeeks(supabase, household.id, members, today);

  const [items, { ingredients, aisles }, settlement] = await Promise.all([
    fridgeItems(supabase, household.id),
    fridgeIngredients(supabase),
    recentSettlement(supabase, household.id, today),
  ]);
  return {
    today,
    items,
    ingredients,
    aisles,
    listWeeks: await listWeeks(supabase, reservedIds(items)),
    settlement: settlement && { ...settlement, remaining: items.length },
  };
}

// La pastille de l'onglet : le nombre d'articles « À finir vite ». Une fois par requête (barre du
// bas et header) ; 0 sans compte, sans foyer, ou si la lecture échoue.
export const fridgeUrgentCount = cache(async (): Promise<number> => {
  await connection();
  try {
    const supabase = await createClient();
    const { data: household } = await supabase.from("households").select("id").order("created_at").limit(1).maybeSingle();
    if (!household) return 0;
    const today = todayInParis();
    const { data, error } = await supabase
      .from("fridge_items")
      .select("best_before, reserved_list_id")
      .eq("household_id", household.id)
      .lte("best_before", addDays(today, SOON_DAYS));
    if (error) return 0;
    const weeks = await listWeeks(supabase, data.flatMap((item) => (item.reserved_list_id ? [item.reserved_list_id] : [])));
    return data.filter((item) => isUrgent(item, item.reserved_list_id ? (weeks[item.reserved_list_id] ?? null) : null, today)).length;
  } catch {
    return 0;
  }
});

// Le frigo du foyer pour la génération du menu par IA : la forme stable de fridgeForMenu.
export async function loadFridgeForMenu(
  householdId: string,
  { supabase, today = todayInParis() }: { supabase?: Client; today?: string } = {},
): Promise<MenuFridgeEntry[]> {
  const client = supabase ?? (await createClient());
  return fridgeForMenu(await fridgeItems(client, householdId), today);
}
