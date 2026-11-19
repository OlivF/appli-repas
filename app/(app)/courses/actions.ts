"use server";

import { SAVE_ERROR } from "@/lib/data";
import {
  ITEM_COLUMNS,
  loadShoppingHousehold,
  loadWeekMenu,
  syncShoppingList,
  toListItem,
  type ListItem,
} from "@/lib/shopping-data";
import { parseManualItem } from "@/lib/shopping-items";
import { createClient } from "@/lib/supabase/server";
import { mondayOf } from "@/lib/week";

// Chaque geste de la liste est enregistré aussitôt ; l'écran l'a déjà affiché (optimiste) et
// revient en arrière si l'action rend une erreur. La RLS garde chaque foyer chez lui.

export type ActionError = { error: string };
export type DoneResult = { ok: true } | ActionError;
export type ItemResult = { item: ListItem } | ActionError;
export type ItemsResult = { items: ListItem[] } | ActionError;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ItemPatch = { checked?: boolean; removed?: boolean; needed?: boolean; quantity_changed?: boolean };

// Une seule ligne doit changer : 0 ligne, c'est un article d'un autre foyer (ou supprimé).
async function patchItem(itemId: string, patch: ItemPatch, manualOnly = false): Promise<DoneResult> {
  if (!UUID.test(itemId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  let query = supabase.from("shopping_items").update(patch).eq("id", itemId);
  if (manualOnly) query = query.eq("manual", true);
  const { data, error } = await query.select("id");
  return error || data.length !== 1 ? { error: SAVE_ERROR } : { ok: true };
}

// Cocher efface la mention « quantité modifiée ».
export async function setCheckedAction(itemId: string, checked: boolean): Promise<DoneResult> {
  return patchItem(itemId, checked ? { checked, quantity_changed: false } : { checked });
}

// « J'en ai déjà » / « Remettre dans la liste ».
export async function setRemovedAction(itemId: string, removed: boolean): Promise<DoneResult> {
  return patchItem(itemId, { removed, checked: false });
}

// « Il n'en reste plus » / « Remettre au placard ».
export async function setNeededAction(itemId: string, needed: boolean): Promise<DoneResult> {
  return patchItem(itemId, { needed, checked: false });
}

export async function uncheckAllAction(listId: string): Promise<DoneResult> {
  if (!UUID.test(listId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.from("shopping_items").update({ checked: false }).eq("list_id", listId);
  return error ? { error: SAVE_ERROR } : { ok: true };
}

export async function addItemAction(listId: string, label: string, quantity: string): Promise<ItemResult> {
  const parsed = parseManualItem(label, quantity);
  if (!parsed.ok) return { error: parsed.error };
  if (!UUID.test(listId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { data: itemId, error } = await supabase.rpc("add_shopping_item", {
    target_list_id: listId,
    raw_label: parsed.label,
    quantity_text: parsed.quantityText ?? "",
  });
  if (error || !itemId) return { error: SAVE_ERROR };
  const { data, error: readError } = await supabase.from("shopping_items").select(ITEM_COLUMNS).eq("id", itemId).single();
  return readError ? { error: SAVE_ERROR } : { item: toListItem(data) };
}

// Un article ajouté à la main se renomme et change de quantité ; les autres non.
export async function editItemAction(itemId: string, label: string, quantity: string): Promise<DoneResult> {
  const parsed = parseManualItem(label, quantity);
  if (!parsed.ok) return { error: parsed.error };
  if (!UUID.test(itemId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_items")
    .update({ label: parsed.label, quantity_text: parsed.quantityText })
    .eq("id", itemId)
    .eq("manual", true)
    .select("id");
  return error || data.length !== 1 ? { error: SAVE_ERROR } : { ok: true };
}

export async function deleteItemAction(itemId: string): Promise<DoneResult> {
  if (!UUID.test(itemId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.from("shopping_items").delete().eq("id", itemId).eq("manual", true).select("id");
  return error || data.length !== 1 ? { error: SAVE_ERROR } : { ok: true };
}

// « Mettre à jour la liste » : recalcule depuis le menu, en gardant ce qui est coché.
export async function updateListAction(weekStart: string): Promise<ItemsResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || mondayOf(weekStart) !== weekStart) return { error: SAVE_ERROR };
  try {
    const { supabase, household, members } = await loadShoppingHousehold();
    const menu = await loadWeekMenu(supabase, household.id, weekStart);
    const synced = await syncShoppingList(supabase, members, weekStart, menu);
    return synced ? { items: synced.items } : { error: SAVE_ERROR };
  } catch {
    return { error: SAVE_ERROR };
  }
}
