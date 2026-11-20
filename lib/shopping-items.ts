import { dayDate } from "@/lib/fridge-items";
import { formatAmounts, isAtHome, shoppingProgress, type ShoppingUnit, type StoredItem } from "@/lib/shopping";
import { addDays, mondayOf, nextWeekStart } from "@/lib/week";

const MAX_LABEL = 80;
const MAX_QUANTITY = 40;

export type ManualItemResult = { ok: true; label: string; quantityText: string | null } | { ok: false; error: string };

// Un article ajouté (ou modifié) à la main : un nom, une quantité libre facultative.
export function parseManualItem(label: string, quantity: string): ManualItemResult {
  const cleanLabel = label.replace(/\s+/g, " ").trim();
  const cleanQuantity = quantity.replace(/\s+/g, " ").trim();
  if (!cleanLabel) return { ok: false, error: "Écris le nom de l'article." };
  if (cleanLabel.length > MAX_LABEL) return { ok: false, error: `Ce nom est trop long (${MAX_LABEL} caractères au plus).` };
  if (cleanQuantity.length > MAX_QUANTITY) {
    return { ok: false, error: `Cette quantité est trop longue (${MAX_QUANTITY} caractères au plus).` };
  }
  return { ok: true, label: cleanLabel, quantityText: cleanQuantity || null };
}

// Sans semaine dans l'adresse : la semaine prochaine si son menu est prêt (on fait les courses
// avant), sinon la semaine en cours.
export async function defaultShoppingWeek(today: string, hasMenu: (weekStart: string) => Promise<boolean>): Promise<string> {
  const next = nextWeekStart(today);
  return (await hasMenu(next)) ? next : mondayOf(today);
}

// ─── Le frigo dans la liste ─────────────────────────────────────────────────

// Ce qui est pris au frigo, arrondi pour se lire : « 200 g », « 1,2 kg », « 4,9 ».
function fridgeAmount(quantity: number, unit: ShoppingUnit) {
  const rounded = unit === "piece" ? Number(quantity.toFixed(1)) : Math.round(quantity);
  return formatAmounts([{ quantity: rounded, unit }]);
}

// La mention d'un article : « 350 g au frigo » (tout y est, « Déjà à la maison »), « + 200 g au
// frigo » (sous la quantité à acheter), « Tu en as peut-être au frigo » (quantité inconnue).
// `unit` : l'unité d'achat de l'ingrédient.
export function fridgeNote(item: StoredItem, unit: ShoppingUnit | null): string | null {
  if (item.from_fridge > 0 && unit) {
    const amount = fridgeAmount(item.from_fridge, unit);
    return isAtHome(item) ? `${amount} au frigo` : `+ ${amount} au frigo`;
  }
  return item.maybe_in_fridge ? "Tu en as peut-être au frigo" : null;
}

// Dans « Pour quoi ? » : « Au frigo : 200 g, jusqu'au mar. 24 » (la date la plus proche).
export function fridgeSourceLine(item: StoredItem, unit: ShoppingUnit | null, bestBefore: string | null, today: string): string | null {
  if (item.from_fridge <= 0 || !unit) return null;
  const until = bestBefore ? `, jusqu’au ${dayDate(bestBefore, today)}` : "";
  return `Au frigo : ${fridgeAmount(item.from_fridge, unit)}${until}`;
}

// ─── Ranger les courses ─────────────────────────────────────────────────────

const MANUAL_QUANTITY = /^(\d+(?:[.,]\d+)?)\s*(kg|g|cl|ml|l)?$/i;
const UNIT_WORDS: Record<string, [factor: number, unit: ShoppingUnit]> = {
  kg: [1000, "g"],
  g: [1, "g"],
  l: [1000, "ml"],
  cl: [10, "ml"],
  ml: [1, "ml"],
};

// La quantité achetée, dans l'unité d'achat : celle de la liste ; pour un article ajouté à la
// main, « 6 » (à la pièce) ou « 500 g », « 1 kg », « 1,5 l » si l'unité colle. Sinon inconnue.
export function storedQuantity(item: StoredItem, unit: ShoppingUnit | null): number | null {
  if (!unit) return null;
  if (!item.manual) return item.amounts.find((amount) => amount.unit === unit)?.quantity ?? null;
  const match = MANUAL_QUANTITY.exec((item.quantity_text ?? "").trim());
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  if (!(value > 0)) return null;
  if (!match[2]) return unit === "piece" ? value : null;
  const [factor, wordUnit] = UNIT_WORDS[match[2].toLowerCase()];
  return wordUnit === unit ? value * factor : null;
}

// Ce qu'on peut ranger : coché, pas encore rangé (ni masqué, ni entièrement au frigo).
export function storeCandidates<T extends StoredItem>(items: readonly T[]): T[] {
  return items.filter((item) => item.checked && !item.stored && !item.removed && !isAtHome(item));
}

// Pré-coché pour le frigo : un ingrédient du référentiel, hors placard, boissons et « Autre ».
export function preStored(item: StoredItem): boolean {
  return item.ingredient_id !== null && !item.pantry && item.aisle !== "boissons" && item.aisle !== "autre";
}

// La carte « Courses faites ? Range-les au frigo » : tant que la proposition n'a pas été
// traitée, quand il y a de quoi ranger, et que tout est coché ou qu'on est au plus tôt le jeudi
// qui précède la semaine (jour du drive).
export function storeProposalVisible({
  items,
  list,
  weekStart,
  today,
}: {
  items: readonly StoredItem[];
  list: { stored_at: string | null; settled_at: string | null };
  weekStart: string;
  today: string;
}): boolean {
  if (list.stored_at || list.settled_at || storeCandidates(items).length === 0) return false;
  const { done, total } = shoppingProgress(items);
  return (total > 0 && done === total) || today >= addDays(weekStart, -4);
}

// ─── La semaine ─────────────────────────────────────────────────────────────

// La bande de /semaine : « À finir : poulet, crème, courgettes et 2 autres ».
export function urgentStripText(labels: readonly string[]): string | null {
  if (labels.length === 0) return null;
  const names = labels.map((label) => label.replace(/^Reste\s*:\s*/i, "").toLocaleLowerCase("fr"));
  const rest = names.length - 3;
  const more = rest > 0 ? ` et ${rest} ${rest > 1 ? "autres" : "autre"}` : "";
  return `À finir : ${names.slice(0, 3).join(", ")}${more}`;
}

// ─── En direct ──────────────────────────────────────────────────────────────

// Un changement reçu de Supabase Realtime (la forme de son `payload`, sans le reste). Pour un
// UPDATE, `new` est la ligne entière ; pour un DELETE, `old` ne porte que l'id.
export type LiveEvent = {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type LiveItem = StoredItem & { id: string };

// Ce qu'un geste sur l'autre téléphone peut changer à un article, et que l'écran reprend tel quel.
// Les quantités et le frigo ne bougent qu'à la mise à jour de la liste, qui touche la liste (rechargée).
const LIVE_FLAGS = ["checked", "removed", "needed", "quantity_changed", "stored"] as const;

function liveFields(row: Record<string, unknown>): Partial<LiveItem> {
  const fields: Partial<LiveItem> = {};
  for (const key of LIVE_FLAGS) if (typeof row[key] === "boolean") fields[key] = row[key];
  if (typeof row.label === "string") fields.label = row.label;
  if (typeof row.quantity_text === "string" || row.quantity_text === null) fields.quantity_text = row.quantity_text;
  return fields;
}

// Applique un changement reçu en direct. Une case cochée (ou « J'en ai déjà », un nom changé…)
// s'applique à l'article, sauf si un geste fait ici est encore en cours d'enregistrement : il
// l'emporte. Un article ajouté ou supprimé ailleurs, une modification d'un article inconnu ici, ou
// la liste elle-même qui change : `reload`, il faut relire les articles. Rien de neuf : la même
// liste (même référence).
export function applyLiveChange<T extends LiveItem>(
  items: T[],
  event: LiveEvent,
  pendingIds: ReadonlySet<string>,
): { items: T[]; reload: boolean } {
  if (event.table !== "shopping_items") return { items, reload: true };
  const id = event.eventType === "DELETE" ? event.old.id : event.new.id;
  const index = items.findIndex((item) => item.id === id);
  const known = index !== -1;
  // Un ajout fait ici est déjà dans la liste ; une suppression d'ailleurs ne concerne que les nôtres.
  if (event.eventType === "INSERT") return { items, reload: !known };
  if (event.eventType === "DELETE") return { items, reload: known };
  if (!known) return { items, reload: true };
  if (pendingIds.has(items[index].id)) return { items, reload: false };

  const current = items[index];
  const fields = liveFields(event.new);
  const changed = (Object.keys(fields) as (keyof typeof fields)[]).some((key) => fields[key] !== current[key]);
  if (!changed) return { items, reload: false };
  const next = [...items];
  next[index] = { ...current, ...fields };
  return { items: next, reload: false };
}

// La liste relue (après un ajout ailleurs, une reconnexion, un retour sur l'onglet), sauf les
// articles dont un geste fait ici est en cours : ils restent comme ici (et un article en train
// d'être supprimé ne revient pas).
export function mergeLiveReload<T extends LiveItem>(current: readonly T[], fresh: readonly T[], pendingIds: ReadonlySet<string>): T[] {
  if (pendingIds.size === 0) return [...fresh];
  const local = new Map(current.map((item) => [item.id, item]));
  return fresh.flatMap((item) => {
    if (!pendingIds.has(item.id)) return [item];
    const mine = local.get(item.id);
    return mine ? [mine] : [];
  });
}
