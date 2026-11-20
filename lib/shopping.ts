import { fnv1a } from "@/lib/hash";
import { DAYS, MEAL_TYPES, type MealType } from "@/lib/meal-slots";
import { dishFactor, type PortionMember } from "@/lib/portions";
import { normalizeText, type GroceryAisle, type IngredientUnit } from "@/lib/recipes";

// La liste de courses de la semaine, calculée sans Supabase : chaque plat à l'échelle de ses
// mangeurs, cumulé par ingrédient canonique, converti dans l'unité d'achat et arrondi pour l'achat.

// ─── Réglages ───────────────────────────────────────────────────────────────

// L'ordre d'un parcours de drive. Le placard vient après, à part.
export const SHOPPING_AISLES: { value: GroceryAisle; label: string }[] = [
  { value: "fruits_legumes", label: "Fruits et légumes" },
  { value: "boucherie", label: "Boucherie" },
  { value: "poissonnerie", label: "Poissonnerie" },
  { value: "cremerie", label: "Crèmerie" },
  { value: "boulangerie", label: "Boulangerie" },
  { value: "epicerie", label: "Épicerie" },
  { value: "surgeles", label: "Surgelés" },
  { value: "boissons", label: "Boissons" },
  { value: "autre", label: "Autre" },
];
export const PANTRY_LABEL = "Placard";

const SPOON_ML = { cas: 15, cac: 5 } as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ShoppingUnit = "g" | "ml" | "piece";
export type AmountUnit = ShoppingUnit | "cas" | "cac";
export type Amount = { quantity: number; unit: AmountUnit };

export type ShoppingSource = { recipeId: string; recipeTitle: string; day: number; mealType: MealType; eaters: number };

export type ShoppingIngredient = {
  id: string;
  name: string;
  aisle: GroceryAisle;
  shopping_unit: ShoppingUnit;
  piece_grams: number | null;
  grams_per_ml: number | null;
  pantry: boolean;
};

export type ShoppingRecipe = {
  id: string;
  title: string;
  servings: number;
  ingredients: {
    ingredient_id: string | null;
    name: string;
    quantity: number | null;
    unit: IngredientUnit | null;
    aisle: GroceryAisle;
  }[];
};

// `skipped` : « Pas cuisiné » (compte pour les courses, pas pour le bilan du frigo).
export type ShoppingMeal = { day: number; meal_type: MealType; recipe_id: string; member_ids: string[]; skipped?: boolean };

export type ComputedItem = {
  key: string;
  ingredientId: string | null;
  label: string;
  aisle: GroceryAisle;
  pantry: boolean;
  amounts: Amount[];
  sources: ShoppingSource[];
  // Pris au frigo, dans l'unité d'achat (jamais plus que le besoin) : la réservation.
  fromFridge: number;
  // Au frigo sans quantité connue : signalé, rien de déduit.
  maybeInFridge: boolean;
};

// Un article tel qu'enregistré (shopping_items).
export type StoredItem = {
  id?: string;
  ingredient_id: string | null;
  label: string;
  amounts: Amount[];
  aisle: GroceryAisle;
  pantry: boolean;
  sources: ShoppingSource[];
  checked: boolean;
  removed: boolean;
  needed: boolean;
  quantity_changed: boolean;
  manual: boolean;
  quantity_text: string | null;
  position: number;
  from_fridge: number;
  maybe_in_fridge: boolean;
  // Déjà rangé au frigo (« Ranger les courses »).
  stored: boolean;
};

// ─── Conversions ────────────────────────────────────────────────────────────

// kg et l repliés en g et ml ; les cuillères restent des cuillères.
function fold(quantity: number, unit: IngredientUnit): Amount {
  if (unit === "kg") return { quantity: quantity * 1000, unit: "g" };
  if (unit === "l") return { quantity: quantity * 1000, unit: "ml" };
  return { quantity, unit };
}

// La quantité dans l'unité d'achat de l'ingrédient, ou null si une donnée manque.
function toShoppingUnit(amount: Amount, ingredient: ShoppingIngredient): number | null {
  const target = ingredient.shopping_unit;
  const { quantity } = amount;
  const unit = amount.unit === "cas" || amount.unit === "cac" ? "ml" : amount.unit;
  const value = amount.unit === "cas" || amount.unit === "cac" ? quantity * SPOON_ML[amount.unit] : quantity;
  if (unit === target) return value;

  const density = ingredient.grams_per_ml;
  const pieceGrams = ingredient.piece_grams;
  const grams = unit === "g" ? value : unit === "ml" ? (density ? value * density : null) : pieceGrams ? value * pieceGrams : null;
  if (grams === null) return null;
  if (target === "g") return grams;
  if (target === "ml") return density ? grams / density : null;
  return pieceGrams ? grams / pieceGrams : null;
}

// Au-dessus, pour l'achat : pièces et cuillères à l'unité ; g et ml à 10 sous 200, à 50 au-delà.
export function roundForPurchase(quantity: number, unit: AmountUnit): number {
  // Les erreurs de virgule flottante (2,0000000000000004) ne font pas acheter une pièce de plus.
  const ceil = (value: number) => Math.ceil(value - 1e-9);
  if (unit === "g" || unit === "ml") {
    const step = quantity < 200 ? 10 : 50;
    return Math.max(10, ceil(quantity / step) * step);
  }
  return Math.max(1, ceil(quantity));
}

// ─── Calcul de la liste ─────────────────────────────────────────────────────

const RESIDUAL_ORDER: AmountUnit[] = ["g", "ml", "piece", "cas", "cac"];
const MEAL_ORDER = MEAL_TYPES.map((meal) => meal.value);

function aisleIndex(aisle: GroceryAisle) {
  return SHOPPING_AISLES.findIndex((item) => item.value === aisle);
}

type Accumulator = {
  key: string;
  ingredient: ShoppingIngredient | null;
  label: string;
  aisle: GroceryAisle;
  main: number;
  residuals: Map<AmountUnit, number>;
  sources: ShoppingSource[];
};

type WeekInput = {
  meals: readonly ShoppingMeal[];
  recipes: readonly ShoppingRecipe[];
  members: readonly PortionMember[];
  ingredients: readonly ShoppingIngredient[];
  weekStart: string;
};

// Chaque plat à l'échelle de ses mangeurs, cumulé par ingrédient canonique : dans l'unité d'achat
// (`main`, exact), ou dans l'unité de la recette quand la conversion manque (`residuals`). La seule
// mise à l'échelle des courses et du bilan du frigo.
function accumulate({ meals, recipes, members, ingredients, weekStart }: WeekInput): Accumulator[] {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const ingredientsById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const items = new Map<string, Accumulator>();

  const ordered = [...meals].sort(
    (a, b) => a.day - b.day || MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type),
  );

  for (const dish of ordered) {
    const recipe = recipesById.get(dish.recipe_id);
    if (!recipe) continue;
    const factor = dishFactor(dish.member_ids, members, recipe.servings, weekStart);
    const source: ShoppingSource = {
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      day: dish.day,
      mealType: dish.meal_type,
      eaters: dish.member_ids.length,
    };

    for (const line of recipe.ingredients) {
      const ingredient = line.ingredient_id ? (ingredientsById.get(line.ingredient_id) ?? null) : null;
      const key = itemKey({ ingredient_id: ingredient?.id ?? null, label: line.name });
      let entry = items.get(key);
      if (!entry) {
        entry = {
          key,
          ingredient,
          label: ingredient?.name ?? line.name,
          aisle: ingredient?.aisle ?? line.aisle,
          main: 0,
          residuals: new Map(),
          sources: [],
        };
        items.set(key, entry);
      }
      if (!entry.sources.includes(source)) entry.sources.push(source);

      if (!ingredient || ingredient.pantry || line.quantity === null || line.unit === null) continue;
      const amount = fold(line.quantity * factor, line.unit);
      const converted = toShoppingUnit(amount, ingredient);
      if (converted !== null) entry.main += converted;
      else entry.residuals.set(amount.unit, (entry.residuals.get(amount.unit) ?? 0) + amount.quantity);
    }
  }
  return [...items.values()];
}

// Le besoin exact des plats cuisinés de la semaine (sans les « Pas cuisiné »), par ingrédient,
// dans l'unité d'achat, sans arrondi. Ni le placard ni les morceaux non convertibles : le bilan
// du frigo ne les déduit pas.
export function weekNeeds(input: WeekInput): Record<string, number> {
  const needs: Record<string, number> = {};
  for (const entry of accumulate({ ...input, meals: input.meals.filter((dish) => !dish.skipped) })) {
    if (entry.ingredient && entry.main > 0) needs[entry.ingredient.id] = entry.main;
  }
  return needs;
}

// La liste de la semaine. `stock` : ce que le frigo peut donner à cette liste, dans l'unité
// d'achat, par ingrédient ; déduit avant l'arrondi. Un article entièrement au frigo reste, sans
// quantité, avec `fromFridge`. `maybeInFridge` : ingrédients au frigo sans quantité (signalés).
export function buildShoppingList({
  stock = {},
  maybeInFridge = new Set(),
  ...week
}: WeekInput & {
  stock?: Record<string, number>;
  maybeInFridge?: ReadonlySet<string>;
}): ComputedItem[] {
  const result: ComputedItem[] = [];
  for (const entry of accumulate(week)) {
    const pantry = !entry.ingredient || entry.ingredient.pantry;
    const amounts: Amount[] = [];
    let fromFridge = 0;

    if (!pantry && entry.ingredient) {
      if (entry.main > 0) {
        fromFridge = Math.min(stock[entry.ingredient.id] ?? 0, entry.main);
        const left = entry.main - fromFridge;
        if (left > 1e-9) {
          const unit = entry.ingredient.shopping_unit;
          amounts.push({ quantity: roundForPurchase(left, unit), unit });
        }
      }
      for (const unit of RESIDUAL_ORDER) {
        const quantity = entry.residuals.get(unit);
        if (!quantity) continue;
        amounts.push({ quantity: roundForPurchase(quantity, unit), unit });
      }
    }

    result.push({
      key: entry.key,
      ingredientId: entry.ingredient?.id ?? null,
      label: entry.label,
      aisle: entry.aisle,
      pantry,
      amounts,
      sources: entry.sources,
      fromFridge,
      maybeInFridge: !pantry && entry.ingredient !== null && maybeInFridge.has(entry.ingredient.id),
    });
  }

  return result.sort(
    (a, b) =>
      Number(a.pantry) - Number(b.pantry) ||
      (a.pantry ? 0 : aisleIndex(a.aisle) - aisleIndex(b.aisle)) ||
      a.label.localeCompare(b.label, "fr"),
  );
}

// Un article calculé se reconnaît à son ingrédient, ou à son nom normalisé s'il n'en a pas.
export function itemKey(item: { ingredient_id: string | null; label: string }): string {
  return item.ingredient_id ?? `nom:${normalizeText(item.label)}`;
}

// ─── Affichage ──────────────────────────────────────────────────────────────

function decimal(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2, useGrouping: false });
}

function formatAmount({ quantity, unit }: Amount): string {
  if (unit === "g") return quantity >= 1000 ? `${decimal(quantity / 1000)} kg` : `${decimal(quantity)} g`;
  if (unit === "ml") return quantity >= 1000 ? `${decimal(quantity / 1000)} l` : `${decimal(quantity)} ml`;
  if (unit === "cas") return `${decimal(quantity)} c. à soupe`;
  if (unit === "cac") return `${decimal(quantity)} c. à café`;
  return decimal(quantity);
}

// « 1,25 kg », « 6 », « 200 g + 2 c. à soupe ».
export function formatAmounts(amounts: readonly Amount[]): string {
  return amounts.map(formatAmount).join(" + ");
}

const MEAL_WORDS: Record<MealType, string> = {
  petit_dej: "petit-déj",
  midi: "midi",
  pique_nique: "pique-nique",
  soir: "soir",
};

// « lun. soir · 4 pers. »
export function sourceDetail(source: ShoppingSource): string {
  const day = `${DAYS[source.day].short.toLocaleLowerCase("fr")}.`;
  return `${day} ${MEAL_WORDS[source.mealType]} · ${source.eaters} pers.`;
}

// « Steak haché et frites · lun. soir · 4 pers. »
export function sourceLabel(source: ShoppingSource): string {
  return `${source.recipeTitle} · ${sourceDetail(source)}`;
}

// Placard : « pour 5 recettes » (recettes différentes).
export function usageLabel(sources: readonly ShoppingSource[]): string {
  const count = new Set(sources.map((source) => source.recipeId)).size;
  return `pour ${count} ${count > 1 ? "recettes" : "recette"}`;
}

// ─── Signature du menu ──────────────────────────────────────────────────────

// Empreinte des recettes et de leurs mangeurs, indépendante de l'ordre : si elle change, la
// liste n'est plus à jour.
export function menuSignature(meals: readonly Pick<ShoppingMeal, "recipe_id" | "member_ids">[]): string {
  const text = meals
    .map((dish) => `${dish.recipe_id}:${[...dish.member_ids].sort().join(",")}`)
    .sort()
    .join("|");
  return fnv1a(text);
}

// ─── Mise à jour ────────────────────────────────────────────────────────────

// Une quantité plus grande, ou une unité qui n'y était pas.
function amountIncreased(before: readonly Amount[], after: readonly Amount[]) {
  return after.some((amount) => {
    const previous = before.find((candidate) => candidate.unit === amount.unit);
    return !previous || amount.quantity > previous.quantity + 1e-9;
  });
}

// La nouvelle liste calculée, avec ce que la liste enregistrée savait déjà : case cochée (sauf si
// la quantité a augmenté : décochée, « quantité modifiée »), « J'en ai déjà », placard passé dans
// la liste. Ce qui n'est plus au menu disparaît. Les articles manuels ne passent pas par ici.
export function mergeShoppingItems(previous: readonly StoredItem[], next: readonly ComputedItem[]): StoredItem[] {
  const before = new Map(previous.filter((item) => !item.manual).map((item) => [itemKey(item), item]));

  return next.map((item, position) => {
    const old = before.get(item.key);
    const increased = old ? amountIncreased(old.amounts, item.amounts) : false;
    const checked = Boolean(old?.checked) && !increased;
    return {
      ingredient_id: item.ingredientId,
      label: item.label,
      amounts: item.amounts,
      aisle: item.aisle,
      pantry: item.pantry,
      sources: item.sources,
      checked,
      removed: old?.removed ?? false,
      needed: old?.needed ?? false,
      quantity_changed: old ? (old.checked && increased) || (old.quantity_changed && !checked) : false,
      manual: false,
      quantity_text: null,
      position,
      from_fridge: item.fromFridge,
      maybe_in_fridge: item.maybeInFridge,
      stored: old?.stored ?? false,
    };
  });
}

// ─── Écran ──────────────────────────────────────────────────────────────────

// Entièrement au frigo : rien à acheter, tout est pris au frigo.
export function isAtHome(item: Pick<StoredItem, "pantry" | "manual" | "amounts" | "from_fridge">): boolean {
  return !item.pantry && !item.manual && item.amounts.length === 0 && item.from_fridge > 0;
}

// À acheter : ni masqué (« J'en ai déjà »), ni entièrement au frigo, ni au placard (sauf « Il
// n'en reste plus »).
function inList(item: StoredItem) {
  return !item.removed && !isAtHome(item) && (!item.pantry || item.needed);
}

function byListOrder(a: StoredItem, b: StoredItem) {
  return Number(a.checked) - Number(b.checked) || Number(a.manual) - Number(b.manual) || a.position - b.position;
}

function byLabel(a: StoredItem, b: StoredItem) {
  return a.label.localeCompare(b.label, "fr");
}

// Les rayons dans l'ordre du drive (non cochés d'abord), le placard, et ce qui est déjà à la
// maison (« J'en ai déjà », ou entièrement au frigo).
export function shoppingSections<T extends StoredItem>(items: readonly T[]) {
  const listed = items.filter(inList);
  return {
    aisles: SHOPPING_AISLES.map(({ value, label }) => {
      const aisleItems = listed.filter((item) => item.aisle === value).sort(byListOrder);
      return { aisle: value, label, items: aisleItems, remaining: aisleItems.filter((item) => !item.checked).length };
    }).filter((section) => section.items.length > 0),
    pantry: items.filter((item) => item.pantry && !item.needed && !item.removed).sort(byLabel),
    home: items.filter((item) => item.removed || isAtHome(item)).sort(byLabel),
  };
}

// « 12 sur 34 ».
export function shoppingProgress(items: readonly StoredItem[]) {
  const listed = items.filter(inList);
  return { done: listed.filter((item) => item.checked).length, total: listed.length };
}

// La quantité d'un article : celle tapée à la main, ou celle calculée.
export function itemQuantity(item: Pick<StoredItem, "manual" | "quantity_text" | "amounts">): string {
  return item.manual ? (item.quantity_text ?? "") : formatAmounts(item.amounts);
}

// Le texte à coller dans une note ou le drive : articles non cochés, par rayon.
export function shoppingListText(weekLabel: string, items: readonly StoredItem[]): string {
  const blocks = shoppingSections(items)
    .aisles.map(({ label, items: aisleItems }) => {
      const lines = aisleItems
        .filter((item) => !item.checked)
        .map((item) => {
          const quantity = itemQuantity(item);
          return quantity ? `- ${item.label} : ${quantity}` : `- ${item.label}`;
        });
      return lines.length > 0 ? [label, ...lines].join("\n") : null;
    })
    .filter(Boolean);
  return [`Courses · ${weekLabel}`, ...blocks].join("\n\n");
}
