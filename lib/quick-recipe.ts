import { MEAL_TYPES } from "@/lib/meal-slots";
import { DIETS, type Diet } from "@/lib/members";
import {
  UNITS,
  isExtra,
  isLightCourse,
  normalizeText,
  parseQuantity,
  type Course,
  type GroceryAisle,
  type IngredientInput,
  type IngredientUnit,
  type RecipeInput,
} from "@/lib/recipes";

// « Créer « Clafoutis » » dans le panneau d'ajout : une recette du foyer en deux touches. Fruit,
// fromage, laitage : un ingrédient pour une personne ; dessert, entrée : le titre seulement, à
// compléter plus tard. Code pur, testé par lib/quick-recipe.test.ts.

// Le rayon de l'ingrédient, s'il est au référentiel, dit la sorte la plus probable.
export function guessCourse(aisle: GroceryAisle | null | undefined): Course | null {
  if (aisle === "fruits_legumes") return "fruit";
  if (aisle === "cremerie") return "dairy";
  return null;
}

const DEFAULT_DIETS: Partial<Record<Course, Diet[]>> = {
  fruit: ["vegetarian", "gluten_free", "lactose_free"],
  dairy: ["vegetarian", "gluten_free"],
  cheese: ["vegetarian", "gluten_free", "keto"],
};

// Sans accents ni majuscules, au singulier simple : « Kiwis » et « kiwi » se valent.
function ingredientKey(name: string) {
  return normalizeText(name)
    .split(/\s+/)
    .map((word) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word))
    .join(" ");
}

// L'ingrédient du référentiel qui porte ce nom (au pluriel près), s'il y en a un.
export function matchKnown<T extends { name: string }>(name: string, known: readonly T[]): T | undefined {
  const key = ingredientKey(name);
  return known.find((ingredient) => ingredientKey(ingredient.name) === key);
}

// Les régimes à confirmer d'une touche : ceux d'une recette légère du catalogue au même ingrédient
// (régimes vérifiés), sinon ceux de la sorte. Rien pour un dessert ou une entrée.
export function guessDiets(
  course: Course,
  ingredient: string,
  catalog: readonly { servings: number; ingredientNames: readonly string[]; diets: readonly Diet[] }[],
): Diet[] {
  if (!isLightCourse(course)) return [];
  const key = ingredientKey(ingredient);
  const twin = catalog.find(
    (recipe) => recipe.servings === 1 && recipe.ingredientNames.length === 1 && ingredientKey(recipe.ingredientNames[0]) === key,
  );
  return [...(twin?.diets ?? DEFAULT_DIETS[course] ?? [])];
}

export type QuickRecipeInput = {
  title: string;
  course: Course;
  // Fruit, fromage, laitage : la portion (« 1 pièce », « 30 g ») et son ingrédient (le titre si vide).
  quantity?: string;
  unit?: IngredientUnit;
  ingredient?: string;
  aisle?: GroceryAisle;
  diets: readonly Diet[];
};

export type QuickRecipeResult =
  | { ok: true; recipe: RecipeInput; ingredients: IngredientInput[] }
  | { ok: false; error: string };

const MAX_TITLE = 120;
const MAX_INGREDIENT_NAME = 80;
const DESSERT_SERVINGS = 4;

// Les valeurs viennent d'une Server Action : on ne se fie pas à leur type.
const text = (value: unknown) => (value === null || value === undefined ? "" : String(value)).trim();

export function quickRecipe(input: QuickRecipeInput): QuickRecipeResult {
  const title = text(input.title);
  if (!title) return { ok: false, error: "Donne un nom." };
  if (title.length > MAX_TITLE) return { ok: false, error: `Ce nom est trop long (${MAX_TITLE} caractères au plus).` };
  if (!isExtra(input.course)) return { ok: false, error: "Un plat se crée depuis les recettes." };

  const light = isLightCourse(input.course);
  const ingredients: IngredientInput[] = [];
  if (light) {
    const quantity = parseQuantity(text(input.quantity));
    if (quantity === null) return { ok: false, error: "Indique une portion en chiffres, par exemple 1 ou 30." };
    const name = text(input.ingredient) || title;
    if (name.length > MAX_INGREDIENT_NAME) return { ok: false, error: "Ce nom d’ingrédient est trop long." };
    ingredients.push({
      name,
      quantity,
      unit: UNITS.find((unit) => unit.value === input.unit)?.value ?? "piece",
      aisle: input.aisle ?? (input.course === "fruit" ? "fruits_legumes" : "cremerie"),
    });
  }

  return {
    ok: true,
    recipe: {
      title,
      description: null,
      photo_url: null,
      meal_types: MEAL_TYPES.map((meal) => meal.value),
      servings: light ? 1 : DESSERT_SERVINGS,
      prep_minutes: 0,
      cook_minutes: 0,
      diets: DIETS.map((diet) => diet.value).filter((diet) => input.diets.includes(diet)),
      steps: [],
      batch_friendly: false,
      batch_notes: null,
      kid_friendly: false,
      base: null,
      basic: false,
      course: input.course,
    },
    ingredients,
  };
}
