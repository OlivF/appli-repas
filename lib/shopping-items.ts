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
