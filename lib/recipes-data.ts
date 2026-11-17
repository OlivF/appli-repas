import { notFound, redirect } from "next/navigation";
import type { AvatarMember } from "@/components/member-avatar";
import { loadHousehold } from "@/lib/data";
import type { MealType } from "@/lib/meal-slots";
import { avatarInitials, type Diet } from "@/lib/members";
import type { GroceryAisle, IngredientUnit } from "@/lib/recipes";

export type RecipeMember = AvatarMember & { diets: Diet[] };

export type ListRecipe = {
  id: string;
  title: string;
  photo_url: string | null;
  meal_types: MealType[];
  minutes: number;
  diets: Diet[];
  batch_friendly: boolean;
  ingredientNames: string[];
  favorite: boolean;
  excludedIds: string[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Foyer terminé (sinon retour au parcours de bienvenue) et ses membres, prêts pour les avatars.
async function loadReadyHousehold() {
  const { supabase, household, members, step } = await loadHousehold();
  if (step !== null || !household) redirect(step ?? "/bienvenue");
  const initials = avatarInitials(members.map((member) => member.first_name));
  const avatars: RecipeMember[] = members.map((member, index) => ({
    id: member.id,
    first_name: member.first_name,
    color: member.color,
    initials: initials[index],
    diets: member.diets,
  }));
  return { supabase, household, members: avatars };
}

// Les recettes du foyer et celles du catalogue qu'il n'a pas copiées, par ordre alphabétique.
export async function loadRecipeList() {
  const { supabase, household, members } = await loadReadyHousehold();

  const [recipesResult, favoritesResult, exclusionsResult] = await Promise.all([
    supabase
      .from("recipes")
      .select(
        "id, household_id, source_recipe_id, title, photo_url, meal_types, prep_minutes, cook_minutes, diets, batch_friendly, recipe_ingredients(name)",
      )
      .or(`household_id.is.null,household_id.eq.${household.id}`),
    supabase.from("recipe_favorites").select("recipe_id").eq("household_id", household.id),
    supabase.from("recipe_member_exclusions").select("recipe_id, member_id").eq("household_id", household.id),
  ]);
  if (recipesResult.error) throw new Error(recipesResult.error.message);
  if (favoritesResult.error) throw new Error(favoritesResult.error.message);
  if (exclusionsResult.error) throw new Error(exclusionsResult.error.message);

  const favorites = new Set(favoritesResult.data.map((row) => row.recipe_id));
  const copied = new Set(recipesResult.data.map((recipe) => recipe.source_recipe_id).filter(Boolean));

  const recipes: ListRecipe[] = recipesResult.data
    .filter((recipe) => !copied.has(recipe.id))
    .map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      photo_url: recipe.photo_url,
      meal_types: recipe.meal_types,
      minutes: recipe.prep_minutes + recipe.cook_minutes,
      diets: recipe.diets,
      batch_friendly: recipe.batch_friendly,
      ingredientNames: recipe.recipe_ingredients.map((ingredient) => ingredient.name),
      favorite: favorites.has(recipe.id),
      excludedIds: exclusionsResult.data
        .filter((row) => row.recipe_id === recipe.id)
        .map((row) => row.member_id),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "fr"));

  return { household, members, recipes };
}

export type RecipeIngredient = {
  name: string;
  quantity: number | null;
  unit: IngredientUnit | null;
  aisle: GroceryAisle;
};

// Une recette visible par le foyer, avec ses ingrédients, son favori et ses exclus.
// Une recette du catalogue que le foyer a copiée renvoie vers la copie.
export async function loadRecipe(id: string) {
  if (!UUID.test(id)) notFound();
  const { supabase, household, members } = await loadReadyHousehold();

  const [recipeResult, copyResult, favoriteResult, exclusionsResult] = await Promise.all([
    supabase
      .from("recipes")
      .select("*, recipe_ingredients(name, quantity, unit, aisle, position)")
      .eq("id", id)
      .order("position", { referencedTable: "recipe_ingredients" })
      .maybeSingle(),
    supabase
      .from("recipes")
      .select("id")
      .eq("household_id", household.id)
      .eq("source_recipe_id", id)
      .maybeSingle(),
    supabase
      .from("recipe_favorites")
      .select("recipe_id")
      .eq("household_id", household.id)
      .eq("recipe_id", id)
      .maybeSingle(),
    supabase
      .from("recipe_member_exclusions")
      .select("member_id")
      .eq("household_id", household.id)
      .eq("recipe_id", id),
  ]);
  for (const result of [recipeResult, copyResult, favoriteResult, exclusionsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  if (copyResult.data) redirect(`/recettes/${copyResult.data.id}`);
  const row = recipeResult.data;
  // Recette inconnue, ou d'un autre foyer (la RLS la cache).
  if (!row || (row.household_id !== null && row.household_id !== household.id)) notFound();

  const { recipe_ingredients: ingredients, ...recipe } = row;
  return {
    supabase,
    household,
    members,
    recipe,
    ingredients: ingredients.map(({ name, quantity, unit, aisle }) => ({ name, quantity, unit, aisle })),
    isCatalog: recipe.household_id === null,
    favorite: Boolean(favoriteResult.data),
    excludedIds: (exclusionsResult.data ?? []).map((row) => row.member_id),
  };
}

export type KnownIngredient = { name: string; aisle: GroceryAisle; unit: IngredientUnit | null };

type Client = Awaited<ReturnType<typeof loadReadyHousehold>>["supabase"];

// Les ingrédients déjà connus (catalogue et recettes du foyer), pour l'autocomplétion.
async function knownIngredients(supabase: Client): Promise<KnownIngredient[]> {
  const { data, error } = await supabase.from("known_ingredients").select("name, aisle, unit").order("name");
  if (error) throw new Error(error.message);
  return data;
}

// De quoi remplir le formulaire : la recette à modifier (jamais une recette du catalogue,
// qu'on copie d'abord), les membres et les ingrédients connus.
export async function loadRecipeForm(id?: string) {
  if (id) {
    const { supabase, recipe, ingredients, members, excludedIds, isCatalog } = await loadRecipe(id);
    if (isCatalog) redirect(`/recettes/${id}`);
    return { recipe, ingredients, members, excludedIds, known: await knownIngredients(supabase) };
  }
  const { supabase, members } = await loadReadyHousehold();
  return {
    recipe: null,
    ingredients: [] as RecipeIngredient[],
    members,
    excludedIds: [] as string[],
    known: await knownIngredients(supabase),
  };
}
