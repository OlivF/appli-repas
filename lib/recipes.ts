import type { MealType } from "@/lib/meal-slots";
import { MEAL_TYPES } from "@/lib/meal-slots";
import { DIETS, type Diet } from "@/lib/members";
import type { Database } from "@/lib/supabase/database.types";

export type IngredientUnit = Database["public"]["Enums"]["ingredient_unit"];
export type GroceryAisle = Database["public"]["Enums"]["grocery_aisle"];

// `short` : ce qu'on écrit après la quantité (rien pour les pièces : « 3 », pas « 3 pièces »).
export const UNITS: { value: IngredientUnit; label: string; short: string }[] = [
  { value: "g", label: "g", short: "g" },
  { value: "kg", label: "kg", short: "kg" },
  { value: "ml", label: "ml", short: "ml" },
  { value: "l", label: "l", short: "l" },
  { value: "piece", label: "pièce", short: "" },
  { value: "cas", label: "c. à soupe", short: "c. à soupe" },
  { value: "cac", label: "c. à café", short: "c. à café" },
];

// Dans l'ordre d'un parcours de magasin (servira à la liste de courses).
export const AISLES: { value: GroceryAisle; label: string }[] = [
  { value: "fruits_legumes", label: "Fruits et légumes" },
  { value: "boulangerie", label: "Boulangerie" },
  { value: "boucherie", label: "Boucherie" },
  { value: "poissonnerie", label: "Poissonnerie" },
  { value: "cremerie", label: "Crèmerie" },
  { value: "epicerie", label: "Épicerie" },
  { value: "surgeles", label: "Surgelés" },
  { value: "boissons", label: "Boissons" },
  { value: "autre", label: "Autre" },
];

export function aisleLabel(aisle: GroceryAisle) {
  return AISLES.find((item) => item.value === aisle)?.label ?? "Autre";
}

// ─── Formulaire ─────────────────────────────────────────────────────────────

export type RecipeInput = {
  title: string;
  description: string | null;
  photo_url: string | null;
  meal_types: MealType[];
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  diets: Diet[];
  steps: string[];
  batch_friendly: boolean;
  batch_notes: string | null;
  kid_friendly: boolean;
};

export type IngredientInput = {
  name: string;
  quantity: number | null;
  unit: IngredientUnit | null;
  aisle: GroceryAisle;
};

export type RecipeFormErrors = Partial<
  Record<
    | "title"
    | "description"
    | "photo_url"
    | "meal_types"
    | "servings"
    | "prep_minutes"
    | "cook_minutes"
    | "ingredients"
    | "batch_notes",
    string
  >
>;

export type RecipeFormResult =
  | { ok: true; recipe: RecipeInput; ingredients: IngredientInput[]; excludedMemberIds: string[] }
  | { ok: false; errors: RecipeFormErrors };

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 300;
const MAX_BATCH_NOTES = 1000;
const MAX_INGREDIENT_NAME = 80;
const MAX_MINUTES = 1440;

// Lit le formulaire d'ajout ou de modification d'une recette.
// `memberIds` : les membres du foyer, seuls exclus possibles.
export function parseRecipeForm(form: FormData, memberIds: string[]): RecipeFormResult {
  const errors: RecipeFormErrors = {};
  const text = (name: string) => String(form.get(name) ?? "").trim();

  const title = text("title");
  if (!title) errors.title = "Donne un titre à la recette.";
  else if (title.length > MAX_TITLE) errors.title = `Ce titre est trop long (${MAX_TITLE} caractères au plus).`;

  const description = text("description");
  if (description.length > MAX_DESCRIPTION) {
    errors.description = `Cette description est trop longue (${MAX_DESCRIPTION} caractères au plus).`;
  }

  const photoUrl = text("photo_url");
  if (photoUrl && !/^https?:\/\/\S+$/i.test(photoUrl)) {
    errors.photo_url = "Colle l’adresse complète de la photo, qui commence par https://.";
  }

  const submittedMeals = new Set(form.getAll("meal_types").map(String));
  const mealTypes = MEAL_TYPES.map((meal) => meal.value).filter((meal) => submittedMeals.has(meal));
  if (mealTypes.length === 0) errors.meal_types = "Choisis au moins un repas.";

  const servings = wholeNumber(text("servings"));
  if (servings === null || servings < 1 || servings > 50) {
    errors.servings = "Indique un nombre de personnes, de 1 à 50.";
  }

  const minutes = (name: "prep_minutes" | "cook_minutes") => {
    const raw = text(name);
    const value = raw === "" ? 0 : wholeNumber(raw);
    if (value === null || value > MAX_MINUTES) {
      errors[name] = "Indique un temps en minutes, par exemple 20.";
      return 0;
    }
    return value;
  };
  const prepMinutes = minutes("prep_minutes");
  const cookMinutes = minutes("cook_minutes");

  const batchFriendly = form.get("batch_friendly") === "on";
  const batchNotes = batchFriendly ? text("batch_notes") : "";
  if (batchNotes.length > MAX_BATCH_NOTES) {
    errors.batch_notes = `Ces notes sont trop longues (${MAX_BATCH_NOTES} caractères au plus).`;
  }

  const submittedDiets = new Set(form.getAll("diets").map(String));
  const diets = DIETS.map((diet) => diet.value).filter((diet) => submittedDiets.has(diet));

  const steps = String(form.get("steps") ?? "")
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean);

  const ingredients = parseIngredients(form);
  if (typeof ingredients === "string") errors.ingredients = ingredients;

  const submittedExcluded = new Set(form.getAll("excluded").map(String));
  const excludedMemberIds = memberIds.filter((id) => submittedExcluded.has(id));

  if (Object.keys(errors).length > 0 || typeof ingredients === "string") return { ok: false, errors };

  return {
    ok: true,
    recipe: {
      title,
      description: description || null,
      photo_url: photoUrl || null,
      meal_types: mealTypes,
      servings: servings!,
      prep_minutes: prepMinutes,
      cook_minutes: cookMinutes,
      diets,
      steps,
      batch_friendly: batchFriendly,
      batch_notes: batchNotes || null,
      kid_friendly: form.get("kid_friendly") === "on",
    },
    ingredients,
    excludedMemberIds,
  };
}

// Les lignes d'ingrédients, ou le message d'erreur de la première ligne fautive.
function parseIngredients(form: FormData): IngredientInput[] | string {
  const names = form.getAll("ingredient_name").map(String);
  const quantities = form.getAll("ingredient_quantity").map(String);
  const units = form.getAll("ingredient_unit").map(String);
  const aisles = form.getAll("ingredient_aisle").map(String);
  const ingredients: IngredientInput[] = [];

  for (const [index, rawName] of names.entries()) {
    const line = `Ligne ${index + 1}`;
    const name = rawName.trim();
    const rawQuantity = (quantities[index] ?? "").trim();
    if (!name && !rawQuantity) continue;
    if (!name) return `${line} : donne un nom à l’ingrédient.`;
    if (name.length > MAX_INGREDIENT_NAME) {
      return `${line} : ce nom est trop long (${MAX_INGREDIENT_NAME} caractères au plus).`;
    }

    let quantity: number | null = null;
    if (rawQuantity) {
      quantity = parseQuantity(rawQuantity);
      if (quantity === null) return `${line} : indique une quantité en chiffres, par exemple 250 ou 1,5.`;
    }

    const unit = UNITS.find((item) => item.value === units[index])?.value ?? "piece";
    const aisle = AISLES.find((item) => item.value === aisles[index])?.value ?? "autre";
    ingredients.push({ name, quantity, unit: quantity === null ? null : unit, aisle });
  }

  return ingredients;
}

function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text) ? Number(text) : null;
}

// « 250 », « 1,5 », « 1.5 », « 1/2 ».
function parseQuantity(text: string): number | null {
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  const value = fraction
    ? Number(fraction[1]) / Number(fraction[2])
    : /^\d+([.,]\d+)?$/.test(text)
      ? Number(text.replace(",", "."))
      : NaN;
  return Number.isFinite(value) && value > 0 && value < 100000 ? value : null;
}

// ─── Quantités ──────────────────────────────────────────────────────────────

export function scaleQuantity(quantity: number, servings: number, persons: number) {
  return (quantity * persons) / servings;
}

// Quantité pour `persons` personnes d'une recette écrite pour `servings`, arrondie pour
// rester lisible en cuisine : « 380 g », « 1,5 kg », « 2 ½ c. à soupe », « 4 ».
export function formatIngredientQuantity(
  quantity: number | null,
  unit: IngredientUnit | null,
  servings: number,
  persons: number,
): string {
  if (quantity === null || unit === null) return "";
  let value = scaleQuantity(quantity, servings, persons);
  let shownUnit = unit;

  if (unit === "g" || unit === "ml") {
    if (value >= 1000) {
      value = roundTo(value / 1000, 0.05);
      shownUnit = unit === "g" ? "kg" : "l";
    } else {
      value = Math.max(1, roundTo(value, value < 20 ? 1 : value < 200 ? 5 : 10));
    }
  } else if (unit === "kg" || unit === "l") {
    value = Math.max(0.05, roundTo(value, 0.05));
  } else {
    value = Math.max(0.5, roundTo(value, 0.5));
  }

  const number = unit === "piece" || unit === "cas" || unit === "cac" ? withHalves(value) : decimal(value);
  const short = UNITS.find((item) => item.value === shownUnit)?.short ?? "";
  return short ? `${number} ${short}` : number;
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function decimal(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2, useGrouping: false });
}

// 0,5 → « ½ », 2,5 → « 2 ½ ».
function withHalves(value: number) {
  const whole = Math.floor(value);
  const half = value - whole >= 0.5;
  if (!half) return String(whole);
  return whole === 0 ? "½" : `${whole} ½`;
}

// « 45 min », « 1 h », « 1 h 15 », « 2 h 05 ».
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

// ─── Recherche et filtres ───────────────────────────────────────────────────

// Sans accents, ligatures ni majuscules : « Œufs à la Crème » → « oeufs a la creme ».
export function normalizeText(text: string) {
  return text
    .toLocaleLowerCase("fr")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Chaque mot cherché doit apparaître dans le titre ou dans un ingrédient.
export function matchesSearch(recipe: { title: string; ingredientNames: string[] }, query: string) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeText([recipe.title, ...recipe.ingredientNames].join(" "));
  return words.every((word) => haystack.includes(word));
}

export type RecipeFilters = {
  query: string;
  mealTypes: MealType[];
  diets: Diet[];
  batch: boolean;
  favorites: boolean;
};

export type FilterableRecipe = {
  title: string;
  ingredientNames: readonly string[];
  meal_types: readonly MealType[];
  diets: readonly Diet[];
  batch_friendly: boolean;
  favorite: boolean;
};

// Repas en « ou » (midi ou dîner), régimes en « et » (céto et sans gluten).
export function filterRecipes<T extends FilterableRecipe>(recipes: T[], filters: RecipeFilters): T[] {
  return recipes.filter(
    (recipe) =>
      matchesSearch({ title: recipe.title, ingredientNames: [...recipe.ingredientNames] }, filters.query) &&
      (filters.mealTypes.length === 0 || filters.mealTypes.some((meal) => recipe.meal_types.includes(meal))) &&
      filters.diets.every((diet) => recipe.diets.includes(diet)) &&
      (!filters.batch || recipe.batch_friendly) &&
      (!filters.favorites || recipe.favorite),
  );
}

// Dans l'adresse : ?q=creme&repas=soir,midi&regime=keto&avance=1&favoris=1
export function filtersFromSearchParams(params: URLSearchParams): RecipeFilters {
  const list = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const meals = list("repas");
  const diets = list("regime");
  return {
    query: params.get("q") ?? "",
    mealTypes: MEAL_TYPES.map((meal) => meal.value).filter((meal) => meals.includes(meal)),
    diets: DIETS.map((diet) => diet.value).filter((diet) => diets.includes(diet)),
    batch: params.get("avance") === "1",
    favorites: params.get("favoris") === "1",
  };
}

export function filtersToSearchParams(filters: RecipeFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query);
  if (filters.mealTypes.length > 0) params.set("repas", filters.mealTypes.join(","));
  if (filters.diets.length > 0) params.set("regime", filters.diets.join(","));
  if (filters.batch) params.set("avance", "1");
  if (filters.favorites) params.set("favoris", "1");
  return params;
}

// ─── Qui mange quoi ─────────────────────────────────────────────────────────

// Les régimes d'un membre que la recette ne respecte pas.
export function incompatibleDiets(recipeDiets: readonly Diet[], memberDiets: readonly Diet[]): Diet[] {
  return memberDiets.filter((diet) => !recipeDiets.includes(diet));
}

// « Céto », « Céto, sans gluten » : pourquoi un membre est écarté d'office.
export function dietReason(diets: readonly Diet[]) {
  return DIETS.filter((diet) => diets.includes(diet.value))
    .map((diet, index) => (index === 0 ? diet.short : diet.short.toLocaleLowerCase("fr")))
    .join(", ");
}

// « diet » : son régime l'écarte (on ne peut pas le réintégrer) ;
// « excluded » : il a été exclu à la main ; « ok » : il en mange.
export function memberEatability(
  recipe: { diets: readonly Diet[] },
  member: { id: string; diets: readonly Diet[] },
  excludedIds: readonly string[],
): "ok" | "excluded" | "diet" {
  if (incompatibleDiets(recipe.diets, member.diets).length > 0) return "diet";
  if (excludedIds.includes(member.id)) return "excluded";
  return "ok";
}

// « Pour tout le monde », « Sauf Léa », « Pour Paul », « Pour personne ».
// On nomme le plus petit des deux groupes.
export function describeEaters(members: { id: string; first_name: string }[], outIds: readonly string[]) {
  const list = (people: { first_name: string }[]) =>
    new Intl.ListFormat("fr", { type: "conjunction" }).format(people.map((member) => member.first_name));
  const eaters = members.filter((member) => !outIds.includes(member.id));
  const out = members.filter((member) => outIds.includes(member.id));
  if (out.length === 0) return "Pour tout le monde";
  if (eaters.length === 0) return "Pour personne";
  return eaters.length < out.length ? `Pour ${list(eaters)}` : `Sauf ${list(out)}`;
}
