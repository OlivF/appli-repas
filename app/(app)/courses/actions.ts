"use server";

import { refresh } from "next/cache";
import { SAVE_ERROR } from "@/lib/data";
import {
  ITEM_COLUMNS,
  loadLiveList,
  loadShoppingHousehold,
  loadWeekMenu,
  syncShoppingList,
  toListItem,
  type ListItem,
  type LiveList,
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
export type LiveListResult = { list: LiveList } | ActionError;

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

// « Mettre à jour la liste » : recalcule depuis le menu et le frigo, en gardant ce qui est
// coché. La page se recharge ensuite (unités et dates du frigo des nouveaux articles).
export async function updateListAction(weekStart: string): Promise<ItemsResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || mondayOf(weekStart) !== weekStart) return { error: SAVE_ERROR };
  try {
    const { supabase, household, members } = await loadShoppingHousehold();
    const menu = await loadWeekMenu(supabase, household.id, weekStart);
    const synced = await syncShoppingList(supabase, household.id, members, weekStart, menu);
    if (!synced) return { error: SAVE_ERROR };
    refresh();
    return { items: synced.items };
  } catch {
    return { error: SAVE_ERROR };
  }
}

export type StoreEntry = { itemId: string; quantity: number | null; bestBefore: string | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// « Ranger N articles » : ils entrent au frigo, réservés à la liste de leur semaine.
export async function storeGroceriesAction(listId: string, entries: StoreEntry[]): Promise<DoneResult> {
  const valid = entries.every(
    (entry) =>
      UUID.test(entry.itemId) &&
      (entry.quantity === null || (Number.isFinite(entry.quantity) && entry.quantity > 0)) &&
      (entry.bestBefore === null || ISO_DATE.test(entry.bestBefore)),
  );
  if (!UUID.test(listId) || !valid || entries.length === 0) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc("store_groceries", {
    target_list_id: listId,
    entries: entries.map((entry) => ({ item_id: entry.itemId, quantity: entry.quantity, best_before: entry.bestBefore })),
  });
  if (error) return { error: SAVE_ERROR };
  // La pastille du Frigo peut changer (un article qui périme avant la fin de la semaine).
  refresh();
  return { ok: true };
}

// « Non merci » : la proposition est traitée, rien n'est rangé.
export async function skipStoringAction(listId: string): Promise<DoneResult> {
  if (!UUID.test(listId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_lists")
    .update({ stored_at: new Date().toISOString() })
    .eq("id", listId)
    .select("id");
  return error || data.length !== 1 ? { error: SAVE_ERROR } : { ok: true };
}

// La liste relue en direct (l'autre téléphone a ajouté, supprimé, mis à jour ou rangé ; retour sur
// l'onglet ; reconnexion). Sans `refresh()` : l'écran garde son panneau ouvert et son défilement.
export async function loadListItemsAction(listId: string): Promise<LiveListResult> {
  if (!UUID.test(listId)) return { error: SAVE_ERROR };
  try {
    const list = await loadLiveList(listId);
    return list ? { list } : { error: SAVE_ERROR };
  } catch {
    return { error: SAVE_ERROR };
  }
}
