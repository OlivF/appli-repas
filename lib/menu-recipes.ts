import type { ShoppingIngredient, ShoppingMeal, ShoppingRecipe } from "@/lib/shopping";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Les recettes des plats, avec leurs lignes, et les ingrédients canoniques de ces lignes : de
// quoi calculer la liste de courses ou le besoin de la semaine.
export async function loadMenuRecipes(
  supabase: Client,
  meals: readonly ShoppingMeal[],
): Promise<{ recipes: ShoppingRecipe[]; ingredients: ShoppingIngredient[] }> {
  const recipeIds = [...new Set(meals.map((meal) => meal.recipe_id))];
  if (recipeIds.length === 0) return { recipes: [], ingredients: [] };
  const { data: recipeRows, error } = await supabase
    .from("recipes")
    .select("id, title, servings, course, recipe_ingredients(ingredient_id, name, quantity, unit, aisle)")
    .in("id", recipeIds);
  if (error) throw new Error(error.message);
  const recipes: ShoppingRecipe[] = recipeRows.map(({ recipe_ingredients, ...recipe }) => ({ ...recipe, ingredients: recipe_ingredients }));

  const ingredientIds = [
    ...new Set(recipes.flatMap((recipe) => recipe.ingredients.map((line) => line.ingredient_id)).filter((id) => id !== null)),
  ];
  const { data: ingredients, error: ingredientsError } = ingredientIds.length
    ? await supabase
        .from("ingredients")
        .select("id, name, aisle, shopping_unit, piece_grams, grams_per_ml, pantry")
        .in("id", ingredientIds)
    : { data: [] as ShoppingIngredient[], error: null };
  if (ingredientsError) throw new Error(ingredientsError.message);
  return { recipes, ingredients };
}
