import { fnv1a } from "@/lib/hash";
import type { ShoppingUnit } from "@/lib/shopping";
import { addDays } from "@/lib/week";

// Le frigo, calculé sans Supabase. Un article est libre (un reste, utilisable par n'importe
// quelle semaine) ou réservé à la liste d'une semaine (acheté pour ce menu-là). Une liste de
// courses compte sur le stock libre et réserve ce qu'elle prend (shopping_items.from_fridge) ;
// le bilan de fin de semaine retire du frigo ce que les plats cuisinés ont consommé.
// Toutes les quantités sont dans l'unité d'achat ; un reste de plat compte des parts.

// ─── Réglages ───────────────────────────────────────────────────────────────

// « Bientôt » : aujourd'hui, demain et après-demain.
export const SOON_DAYS = 2;

// Au bilan, ce qui reste en dessous est supprimé (un fond de pot, un bout d'œuf).
const RESIDUAL: Record<ShoppingUnit, number> = { g: 10, ml: 10, piece: 0.5 };

const EPSILON = 1e-9;

// ─── Types ──────────────────────────────────────────────────────────────────

export type FridgeOrigin = "manual" | "shopping" | "leftover";
export type FridgeStatus = "expired" | "soon" | "ok" | "none";

// Un article tel qu'enregistré (fridge_items).
export type FridgeItem = {
  id: string;
  ingredient_id: string | null;
  label: string;
  quantity: number | null;
  unit: ShoppingUnit | null;
  best_before: string | null;
  origin: FridgeOrigin;
  recipe_id: string | null;
  reserved_list_id: string | null;
};

// Ce qu'une liste pas encore soldée a pris au frigo pour un ingrédient.
export type Reservation = { list_id: string; ingredient_id: string | null; from_fridge: number };

// Le stock libre d'une liste, par ingrédient ; `maybe` : ingrédients au frigo sans quantité.
export type FridgeStock = { stock: Record<string, number>; maybe: Set<string> };

export type SettlementChange = { id: string; quantity: number | null };

// ─── Dates ──────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

// 0 = aujourd'hui, 1 = demain, -1 = hier.
export function daysLeft(bestBefore: string, today: string): number {
  return Math.round((Date.parse(`${bestBefore}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

export function fridgeStatus(item: Pick<FridgeItem, "best_before">, today: string): FridgeStatus {
  if (!item.best_before) return "none";
  const left = daysLeft(item.best_before, today);
  if (left < 0) return "expired";
  return left <= SOON_DAYS ? "soon" : "ok";
}

// La date limite proposée en rangeant un ingrédient : aujourd'hui + sa durée de conservation.
export function defaultBestBefore(ingredient: { shelf_life_days: number | null } | null, today: string): string | null {
  return ingredient?.shelf_life_days ? addDays(today, ingredient.shelf_life_days) : null;
}

// ─── Stock d'une liste ──────────────────────────────────────────────────────

// Pour la liste `listId` : par ingrédient, les articles libres moins ce que réservent les autres
// listes pas encore soldées (jamais négatif) ; à part, les ingrédients libres sans quantité.
// `reservations` ne doit contenir que des listes pas soldées.
export function availableStock({
  items,
  reservations,
  listId,
}: {
  items: readonly FridgeItem[];
  reservations: readonly Reservation[];
  listId: string | null;
}): FridgeStock {
  const totals = new Map<string, number>();
  const maybe = new Set<string>();
  for (const item of items) {
    if (item.reserved_list_id !== null || item.ingredient_id === null) continue;
    if (item.quantity === null) maybe.add(item.ingredient_id);
    else totals.set(item.ingredient_id, (totals.get(item.ingredient_id) ?? 0) + item.quantity);
  }
  for (const reservation of reservations) {
    const id = reservation.ingredient_id;
    if (reservation.list_id === listId || id === null || !totals.has(id)) continue;
    totals.set(id, (totals.get(id) ?? 0) - reservation.from_fridge);
  }

  const stock: Record<string, number> = {};
  for (const [id, quantity] of totals) if (quantity > EPSILON) stock[id] = quantity;
  return { stock, maybe };
}

// Empreinte du stock pour les ingrédients du menu, indépendante de l'ordre : si elle change, la
// liste n'est plus à jour. Vide quand le frigo ne concerne pas le menu (comme une liste
// enregistrée avant le frigo : pas de bandeau pour rien).
export function fridgeSignature({ stock, maybe }: FridgeStock, ingredientIds: Iterable<string>): string {
  const parts: string[] = [];
  for (const id of [...new Set(ingredientIds)].sort()) {
    const quantity = stock[id];
    if (quantity) parts.push(`${id}:${Number(quantity.toFixed(3))}`);
    if (maybe.has(id)) parts.push(`${id}:?`);
  }
  return parts.length > 0 ? fnv1a(parts.join("|")) : "";
}

// ─── Bilan de la semaine ────────────────────────────────────────────────────

// La date la plus proche d'abord, les articles sans date en dernier.
function byBestBefore(a: FridgeItem, b: FridgeItem) {
  if (a.best_before === b.best_before) return 0;
  if (a.best_before === null) return 1;
  if (b.best_before === null) return -1;
  return a.best_before < b.best_before ? -1 : 1;
}

// Prend `amount` dans ces articles, dans l'ordre ; rend ce qui n'a pas pu être pris.
function consume(items: readonly FridgeItem[], amount: number, changes: SettlementChange[]): number {
  let left = amount;
  for (const item of items) {
    if (left <= EPSILON) break;
    const quantity = item.quantity ?? 0;
    const taken = Math.min(quantity, left);
    left -= taken;
    const rest = Number((quantity - taken).toFixed(3));
    const residual = item.unit ? RESIDUAL[item.unit] : EPSILON;
    changes.push({ id: item.id, quantity: rest < residual ? null : rest });
  }
  return left;
}

// `needs` : besoin exact des plats cuisinés de la semaine, par ingrédient (weekNeeds, plats
// « Pas cuisiné » exclus). On consomme d'abord ce qui a été rangé pour cette liste, puis les
// restes libres dans la limite de ce que la liste a pris au frigo (`fromFridge`). Les articles
// sans quantité et les restes de plat ne bougent pas. Rend les changements pour
// apply_fridge_settlement (nouvelle quantité, ou null : à supprimer).
export function settleWeek({
  items,
  listId,
  fromFridge,
  needs,
}: {
  items: readonly FridgeItem[];
  listId: string;
  fromFridge: Record<string, number>;
  needs: Record<string, number>;
}): SettlementChange[] {
  const changes: SettlementChange[] = [];
  for (const [ingredientId, need] of Object.entries(needs)) {
    if (need <= EPSILON) continue;
    const known = items.filter((item) => item.ingredient_id === ingredientId && item.quantity !== null);
    const reserved = known.filter((item) => item.reserved_list_id === listId).sort(byBestBefore);
    const free = known.filter((item) => item.reserved_list_id === null).sort(byBestBefore);
    const left = consume(reserved, need, changes);
    consume(free, Math.min(left, fromFridge[ingredientId] ?? 0), changes);
  }
  return changes;
}

// ─── Pour le menu par IA ────────────────────────────────────────────────────

// Contrat pour le menu IA : ne pas changer sans mettre à jour le prompt.
// Le frigo trié par urgence (périmé, bientôt, sans date, ok), puis par date et par nom.
export type MenuFridgeEntry = {
  ingredientId: string | null;
  recipeId: string | null;
  name: string;
  quantity: number | null;
  unit: ShoppingUnit | null;
  bestBefore: string | null;
  daysLeft: number | null;
  status: FridgeStatus;
  reserved: boolean;
};

const URGENCY: Record<FridgeStatus, number> = { expired: 0, soon: 1, none: 2, ok: 3 };

export function fridgeForMenu(items: readonly FridgeItem[], today: string): MenuFridgeEntry[] {
  return items
    .map((item) => ({
      ingredientId: item.ingredient_id,
      recipeId: item.recipe_id,
      name: item.label,
      quantity: item.quantity,
      unit: item.unit,
      bestBefore: item.best_before,
      daysLeft: item.best_before ? daysLeft(item.best_before, today) : null,
      status: fridgeStatus(item, today),
      reserved: item.reserved_list_id !== null,
    }))
    .sort(
      (a, b) =>
        URGENCY[a.status] - URGENCY[b.status] ||
        (a.daysLeft ?? 0) - (b.daysLeft ?? 0) ||
        a.name.localeCompare(b.name, "fr"),
    );
}
