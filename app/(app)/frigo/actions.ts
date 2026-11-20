"use server";

import { refresh } from "next/cache";
import { SAVE_ERROR } from "@/lib/data";
import type { FridgeItem } from "@/lib/fridge";
import { FRIDGE_COLUMNS, toFridgeItem } from "@/lib/fridge-data";
import { parseFridgeInput } from "@/lib/fridge-items";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayInParis } from "@/lib/week";

// Chaque geste du frigo est enregistré aussitôt ; l'écran l'a déjà affiché (optimiste) et revient
// en arrière si l'action rend une erreur. La RLS garde chaque foyer chez lui. Après chaque
// geste, la page et la pastille de l'onglet se rafraîchissent.

export type ActionError = { error: string };
export type DoneResult = { ok: true } | ActionError;
export type FridgeItemResult = { item: FridgeItem } | ActionError;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Client = Awaited<ReturnType<typeof createClient>>;

async function householdId(supabase: Client) {
  const { data } = await supabase.from("households").select("id").order("created_at").limit(1).maybeSingle();
  return data?.id ?? null;
}

// Ranger un article : un ingrédient du référentiel (son nom canonique), ou un texte libre.
export async function addFridgeItemAction(input: {
  label: string;
  ingredientId: string | null;
  quantity: string;
  bestBefore: string | null;
}): Promise<FridgeItemResult> {
  const parsed = parseFridgeInput(input);
  if (!parsed.ok) return { error: parsed.error };
  if (input.ingredientId !== null && !UUID.test(input.ingredientId)) return { error: SAVE_ERROR };

  const supabase = await createClient();
  const household = await householdId(supabase);
  if (!household) return { error: SAVE_ERROR };

  let label = parsed.label;
  if (input.ingredientId) {
    const { data: known } = await supabase.from("ingredients").select("name").eq("id", input.ingredientId).maybeSingle();
    if (!known) return { error: SAVE_ERROR };
    label = known.name;
  }

  const { data, error } = await supabase
    .from("fridge_items")
    .insert({
      household_id: household,
      ingredient_id: input.ingredientId,
      label,
      quantity: parsed.quantity,
      best_before: parsed.bestBefore,
      origin: "manual",
    })
    .select(FRIDGE_COLUMNS)
    .single();
  if (error) return { error: SAVE_ERROR };
  refresh();
  return { item: toFridgeItem(data) };
}

// Changer la quantité ou la date d'un article (le nom ne change pas).
export async function updateFridgeItemAction(
  itemId: string,
  input: { quantity: string; bestBefore: string | null },
): Promise<FridgeItemResult> {
  const parsed = parseFridgeInput({ label: "article", ...input });
  if (!parsed.ok) return { error: parsed.error };
  if (!UUID.test(itemId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fridge_items")
    .update({ quantity: parsed.quantity, best_before: parsed.bestBefore })
    .eq("id", itemId)
    .select(FRIDGE_COLUMNS);
  if (error || data.length !== 1) return { error: SAVE_ERROR };
  refresh();
  return { item: toFridgeItem(data[0]) };
}

// « Fini » : l'article sort du frigo. « Annuler » le remet tel quel (restoreFridgeItemAction).
export async function finishFridgeItemAction(itemId: string): Promise<DoneResult> {
  if (!UUID.test(itemId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.from("fridge_items").delete().eq("id", itemId).select("id");
  if (error || data.length !== 1) return { error: SAVE_ERROR };
  refresh();
  return { ok: true };
}

export async function restoreFridgeItemAction(item: FridgeItem): Promise<DoneResult> {
  const parsed = parseFridgeInput({ label: item.label, quantity: item.quantity === null ? "" : String(item.quantity), bestBefore: item.best_before });
  const ids = [item.id, item.ingredient_id, item.recipe_id, item.reserved_list_id];
  if (!parsed.ok || ids.some((id) => id !== null && !UUID.test(id))) return { error: SAVE_ERROR };

  const supabase = await createClient();
  const household = await householdId(supabase);
  if (!household) return { error: SAVE_ERROR };
  const { error } = await supabase.from("fridge_items").insert({
    id: item.id,
    household_id: household,
    ingredient_id: item.ingredient_id,
    label: parsed.label,
    quantity: parsed.quantity,
    unit: item.unit,
    best_before: parsed.bestBefore,
    origin: item.origin,
    recipe_id: item.recipe_id,
    reserved_list_id: item.reserved_list_id,
  });
  if (error) return { error: SAVE_ERROR };
  refresh();
  return { ok: true };
}

// « C'est un reste » : un article rangé pour le menu d'une semaine devient libre.
export async function freeFridgeItemAction(itemId: string): Promise<DoneResult> {
  if (!UUID.test(itemId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.from("fridge_items").update({ reserved_list_id: null }).eq("id", itemId).select("id");
  if (error || data.length !== 1) return { error: SAVE_ERROR };
  refresh();
  return { ok: true };
}

// Un reste se garde trois jours.
const LEFTOVER_DAYS = 3;
const MAX_PARTS = 50;

// « Il en reste » sur un plat : « Reste : Lasagnes », N parts, libre, à finir dans 3 jours.
export async function addLeftoverAction(recipeId: string, parts: number): Promise<DoneResult> {
  if (!UUID.test(recipeId) || !Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const household = await householdId(supabase);
  if (!household) return { error: SAVE_ERROR };
  const { data: recipe } = await supabase.from("recipes").select("title").eq("id", recipeId).maybeSingle();
  if (!recipe) return { error: SAVE_ERROR };
  const { error } = await supabase.from("fridge_items").insert({
    household_id: household,
    label: `Reste : ${recipe.title}`.slice(0, 80),
    quantity: parts,
    best_before: addDays(todayInParis(), LEFTOVER_DAYS),
    origin: "leftover",
    recipe_id: recipeId,
  });
  return error ? { error: SAVE_ERROR } : { ok: true };
}
