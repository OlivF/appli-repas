import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loadHousehold } from "@/lib/data";
import { SOON_DAYS, fridgeForMenu, type FridgeItem, type MenuFridgeEntry, type Reservation } from "@/lib/fridge";
import { isUrgent, type FridgeIngredient } from "@/lib/fridge-items";
import { settleFinishedWeeks } from "@/lib/fridge-settlement";
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

// Ce que les listes pas encore soldées du foyer ont pris au frigo (shopping_items.from_fridge).
export async function openReservations(supabase: Client, householdId: string): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from("shopping_items")
    .select("list_id, ingredient_id, from_fridge, shopping_lists!inner(settled_at)")
    .eq("household_id", householdId)
    .gt("from_fridge", 0)
    .is("shopping_lists.settled_at", null);
  if (error) throw new Error(error.message);
  return data.map(({ list_id, ingredient_id, from_fridge }) => ({ list_id, ingredient_id, from_fridge: Number(from_fridge) }));
}

// Tout ce que l'écran /frigo affiche. D'abord le bilan des semaines finies.
export async function loadFridge() {
  const { supabase, household, step } = await loadHousehold();
  if (step !== null || !household) redirect(step ?? "/bienvenue");
  const today = todayInParis();
  await settleFinishedWeeks(supabase, household.id, today);

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

// Les articles « À finir vite » (leurs noms, date la plus proche d'abord), une fois par requête :
// la pastille de l'onglet (barre du bas et header) et la bande de /semaine. Rien sans compte,
// sans foyer, ou si la lecture échoue.
export const fridgeUrgentLabels = cache(async (): Promise<string[]> => {
  await connection();
  try {
    const supabase = await createClient();
    const { data: household } = await supabase.from("households").select("id").order("created_at").limit(1).maybeSingle();
    if (!household) return [];
    const today = todayInParis();
    const { data, error } = await supabase
      .from("fridge_items")
      .select("label, best_before, reserved_list_id")
      .eq("household_id", household.id)
      .lte("best_before", addDays(today, SOON_DAYS))
      .order("best_before")
      .order("label");
    if (error) return [];
    const weeks = await listWeeks(supabase, data.flatMap((item) => (item.reserved_list_id ? [item.reserved_list_id] : [])));
    return data
      .filter((item) => isUrgent(item, item.reserved_list_id ? (weeks[item.reserved_list_id] ?? null) : null, today))
      .map((item) => item.label);
  } catch {
    return [];
  }
});

export async function fridgeUrgentCount(): Promise<number> {
  return (await fridgeUrgentLabels()).length;
}

// Le frigo du foyer pour la génération du menu par IA : la forme stable de fridgeForMenu.
export async function loadFridgeForMenu(
  householdId: string,
  { supabase, today = todayInParis() }: { supabase?: Client; today?: string } = {},
): Promise<MenuFridgeEntry[]> {
  const client = supabase ?? (await createClient());
  return fridgeForMenu(await fridgeItems(client, householdId), today);
}
