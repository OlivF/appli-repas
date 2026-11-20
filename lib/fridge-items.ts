import { daysLeft, fridgeStatus, type FridgeItem } from "@/lib/fridge";
import type { GroceryAisle } from "@/lib/recipes";
import { SHOPPING_AISLES, formatAmounts, type ShoppingUnit } from "@/lib/shopping";
import { addDays } from "@/lib/week";

// L'écran Frigo, sans Supabase : retrouver un ingrédient tapé, lire une quantité, dire une date,
// ranger les articles en sections.

// ─── Référentiel ────────────────────────────────────────────────────────────

// Un ingrédient du référentiel, tel que l'ajout au frigo le connaît.
export type FridgeIngredient = {
  id: string;
  name: string;
  name_key: string;
  aliases: string[];
  aisle: GroceryAisle;
  shopping_unit: ShoppingUnit;
  shelf_life_days: number | null;
};

// La même clé que private.ingredient_key en base : minuscules, ligatures et accents retirés,
// ponctuation en espaces, chaque mot de plus de trois lettres sans son s ou x final.
export function ingredientKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/’/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word))
    .join(" ");
}

// Par nom, puis par alias (la liste donne le foyer avant le commun).
export function findIngredient(text: string, ingredients: readonly FridgeIngredient[]): FridgeIngredient | null {
  const key = ingredientKey(text);
  if (!key) return null;
  return (
    ingredients.find((ingredient) => ingredient.name_key === key) ??
    ingredients.find((ingredient) => ingredient.aliases.includes(key)) ??
    null
  );
}

// ─── Quantités ──────────────────────────────────────────────────────────────

export const UNIT_WORDS: Record<ShoppingUnit, string> = { g: "g", ml: "ml", piece: "pièces" };

const MAX_QUANTITY = 100_000;
const QUANTITY_ERROR = "Indique un nombre, par exemple 200.";

export type QuantityResult = { ok: true; quantity: number | null } | { ok: false; error: string };

// « 200 », « 1,5 » ; vide : quantité inconnue.
export function parseQuantity(text: string): QuantityResult {
  const clean = text.trim().replace(",", ".");
  if (!clean) return { ok: true, quantity: null };
  const quantity = Number(clean);
  if (!/^\d+(\.\d+)?$/.test(clean) || !(quantity > 0) || quantity > MAX_QUANTITY) return { ok: false, error: QUANTITY_ERROR };
  return { ok: true, quantity };
}

const MAX_LABEL = 80;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(text: string) {
  const date = new Date(`${text}T00:00:00Z`);
  return ISO_DATE.test(text) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

export type FridgeInputResult =
  | { ok: true; label: string; quantity: number | null; bestBefore: string | null }
  | { ok: false; error: string };

// Un article rangé à la main ou modifié : un nom, une quantité et une date facultatives.
export function parseFridgeInput(input: { label: string; quantity: string; bestBefore: string | null }): FridgeInputResult {
  const label = input.label.replace(/\s+/g, " ").trim();
  if (!label) return { ok: false, error: "Écris ce que tu ranges." };
  if (label.length > MAX_LABEL) return { ok: false, error: `Ce nom est trop long (${MAX_LABEL} caractères au plus).` };
  const quantity = parseQuantity(input.quantity);
  if (!quantity.ok) return quantity;
  if (input.bestBefore !== null && !isDate(input.bestBefore)) return { ok: false, error: "Choisis une date." };
  return { ok: true, label, quantity: quantity.quantity, bestBefore: input.bestBefore };
}

// Le pas des boutons − / + : 50 g, 50 ml, 1 pièce, 1 part.
export function quantityStep(unit: ShoppingUnit | null): number {
  return unit === "g" || unit === "ml" ? 50 : 1;
}

function isLeftoverDish(item: Pick<FridgeItem, "origin" | "recipe_id">) {
  return item.origin === "leftover" || item.recipe_id !== null;
}

// « 200 g », « 1,2 kg », « 3 », « 2 parts », ou rien quand on ne sait pas.
export function formatFridgeQuantity(item: Pick<FridgeItem, "quantity" | "unit" | "origin" | "recipe_id">): string {
  if (item.quantity === null) return "";
  if (item.unit) return formatAmounts([{ quantity: item.quantity, unit: item.unit }]);
  const count = item.quantity.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  if (isLeftoverDish(item)) return `${count} ${item.quantity > 1 ? "parts" : "part"}`;
  return count;
}

// ─── Dates ──────────────────────────────────────────────────────────────────

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function parts(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDate();
  return { weekday: WEEKDAYS[value.getUTCDay()], day: day === 1 ? "1er" : String(day), month: MONTHS[value.getUTCMonth()] };
}

// « 16 nov. », « 1er déc. ».
export function shortDate(date: string): string {
  const { day, month } = parts(date);
  return `${day} ${month}`;
}

// « jeu. 26 » ; avec le mois quand ce n'est pas celui d'aujourd'hui : « mar. 1er déc. ».
export function dayDate(date: string, today: string): string {
  const { weekday, day, month } = parts(date);
  return date.slice(0, 7) === today.slice(0, 7) ? `${weekday} ${day}` : `${weekday} ${day} ${month}`;
}

export type DateTone = "expired" | "soon" | "ok";

// Ce que dit la ligne : « Périmé hier ? » (tomate), « Demain » (moutarde), « jusqu'au jeu. 26 ».
export function bestBeforeLabel(bestBefore: string | null, today: string): { text: string; tone: DateTone } | null {
  if (!bestBefore) return null;
  const left = daysLeft(bestBefore, today);
  if (left === -1) return { text: "Périmé hier ?", tone: "expired" };
  if (left < -1) return { text: `Périmé depuis ${-left} jours ?`, tone: "expired" };
  if (left === 0) return { text: "Aujourd’hui", tone: "soon" };
  if (left === 1) return { text: "Demain", tone: "soon" };
  if (left === 2) return { text: "Après-demain", tone: "soon" };
  return { text: `jusqu’au ${dayDate(bestBefore, today)}`, tone: "ok" };
}

export type DatePreset = "today" | "tomorrow" | "3days" | "week" | "custom" | "none";

// Les puces de la date limite, dans l'ordre.
export const DATE_PRESETS: { value: DatePreset; label: string; days?: number }[] = [
  { value: "today", label: "Aujourd’hui", days: 0 },
  { value: "tomorrow", label: "Demain", days: 1 },
  { value: "3days", label: "Dans 3 jours", days: 3 },
  { value: "week", label: "Dans 1 semaine", days: 7 },
  { value: "custom", label: "Choisir…" },
  { value: "none", label: "Pas de date" },
];

// La puce d'une date : un préréglage si elle tombe juste, sinon « Choisir… ».
export function presetFor(date: string | null, today: string): DatePreset {
  if (!date) return "none";
  const left = daysLeft(date, today);
  return DATE_PRESETS.find((preset) => preset.days === left)?.value ?? "custom";
}

export function dateForPreset(preset: DatePreset, custom: string | null, today: string): string | null {
  if (preset === "none") return null;
  if (preset === "custom") return custom || null;
  const days = DATE_PRESETS.find((entry) => entry.value === preset)?.days ?? 0;
  return addDays(today, days);
}

// ─── Sections de l'écran ────────────────────────────────────────────────────

// « À finir vite » : périmé ou bientôt. Un article réservé ne l'est que si sa date tombe avant la
// fin (le dimanche) de la semaine de son menu.
export function isUrgent(item: Pick<FridgeItem, "best_before" | "reserved_list_id">, listWeekStart: string | null, today: string): boolean {
  const status = fridgeStatus(item, today);
  if (status !== "expired" && status !== "soon") return false;
  if (item.reserved_list_id === null || listWeekStart === null || !item.best_before) return true;
  return item.best_before <= addDays(listWeekStart, 6);
}

// La date la plus proche d'abord, sans date en dernier, puis le nom.
function byDateThenName(a: FridgeItem, b: FridgeItem) {
  if (a.best_before !== b.best_before) {
    if (a.best_before === null) return 1;
    if (b.best_before === null) return -1;
    return a.best_before < b.best_before ? -1 : 1;
  }
  return a.label.localeCompare(b.label, "fr");
}

export const DISHES_LABEL = "Plats";

export type FridgeGroup = { key: GroceryAisle | "plats"; label: string; items: FridgeItem[] };

// Chaque article une seule fois : « À finir vite », sinon « Restes » (libres : les plats d'abord,
// puis par rayon dans l'ordre du drive ; sans ingrédient, « Autre »), sinon « Pour le menu de la
// semaine » (réservés, par semaine). `listWeeks` : le lundi de chaque liste ; `aisles` : le rayon
// de chaque ingrédient.
export function fridgeSections(
  items: readonly FridgeItem[],
  {
    listWeeks,
    aisles,
    today,
  }: { listWeeks: Record<string, string>; aisles: Record<string, GroceryAisle>; today: string },
) {
  const weekOf = (item: FridgeItem) => (item.reserved_list_id ? (listWeeks[item.reserved_list_id] ?? null) : null);
  const urgent = items.filter((item) => isUrgent(item, weekOf(item), today)).sort(byDateThenName);
  const rest = items.filter((item) => !urgent.includes(item));

  const free = rest.filter((item) => item.reserved_list_id === null);
  const dishes = free.filter(isLeftoverDish);
  const groups: FridgeGroup[] = [{ key: "plats", label: DISHES_LABEL, items: dishes }];
  for (const { value, label } of SHOPPING_AISLES) {
    groups.push({
      key: value,
      label,
      items: free.filter(
        (item) => !isLeftoverDish(item) && ((item.ingredient_id && aisles[item.ingredient_id]) || "autre") === value,
      ),
    });
  }

  const reserved = new Map<string, FridgeItem[]>();
  for (const item of rest.filter((entry) => entry.reserved_list_id !== null)) {
    const week = weekOf(item) ?? "";
    reserved.set(week, [...(reserved.get(week) ?? []), item]);
  }

  return {
    urgent,
    leftovers: groups
      .filter((group) => group.items.length > 0)
      .map((group) => ({ ...group, items: [...group.items].sort(byDateThenName) })),
    reserved: [...reserved.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([weekStart, weekItems]) => ({ weekStart, items: weekItems.sort(byDateThenName) })),
  };
}

// ─── Bilan ──────────────────────────────────────────────────────────────────

export function settlementText(weekStart: string, remaining: number): string {
  const rest =
    remaining === 0 ? "Le frigo est vide." : `Il te reste ${remaining} ${remaining > 1 ? "articles" : "article"}.`;
  return `Semaine du ${shortDate(weekStart)} terminée : on a retiré ce qui a été cuisiné. ${rest}`;
}
