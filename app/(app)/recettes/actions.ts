"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { SAVE_ERROR, loadHousehold } from "@/lib/data";
import { parseRecipeForm, type RecipeFormErrors } from "@/lib/recipes";

// Foyer du compte connecté ; un parcours inachevé renvoie à /bienvenue.
async function household() {
  const data = await loadHousehold();
  if (!data.household) redirect("/bienvenue");
  return { ...data, household: data.household };
}

export type ToggleResult = { error?: string };

// Met une recette (du foyer ou du catalogue) en favori, ou l'en retire.
export async function toggleFavorite(recipeId: string, on: boolean): Promise<ToggleResult> {
  const { supabase, household: { id } } = await household();
  const { error } = on
    ? await supabase.from("recipe_favorites").upsert({ household_id: id, recipe_id: recipeId })
    : await supabase.from("recipe_favorites").delete().eq("household_id", id).eq("recipe_id", recipeId);
  if (error) return { error: SAVE_ERROR };
  refresh();
  return {};
}

// Note qu'un membre ne mange pas une recette (du foyer ou du catalogue), ou l'annule.
export async function toggleExclusion(recipeId: string, memberId: string, excluded: boolean): Promise<ToggleResult> {
  const { supabase, household: { id } } = await household();
  const { error } = excluded
    ? await supabase
        .from("recipe_member_exclusions")
        .upsert({ household_id: id, recipe_id: recipeId, member_id: memberId })
    : await supabase
        .from("recipe_member_exclusions")
        .delete()
        .eq("household_id", id)
        .eq("recipe_id", recipeId)
        .eq("member_id", memberId);
  if (error) return { error: SAVE_ERROR };
  refresh();
  return {};
}

// Copie une recette du catalogue dans les recettes du foyer et ouvre son formulaire.
export async function copyRecipe(formData: FormData) {
  const { supabase, household: { id } } = await household();
  const { data, error } = await supabase.rpc("copy_recipe", {
    catalog_recipe_id: String(formData.get("id") ?? ""),
    target_household_id: id,
  });
  if (error) throw new Error(SAVE_ERROR);
  redirect(`/recettes/${data}/modifier`);
}

export type RecipeFormState = { errors: RecipeFormErrors & { form?: string } } | null;

// Ajoute une recette, ou la modifie quand le formulaire porte son id.
export async function saveRecipe(_state: RecipeFormState, formData: FormData): Promise<RecipeFormState> {
  const { supabase, household: { id }, members } = await household();
  const parsed = parseRecipeForm(
    formData,
    members.map((member) => member.id),
  );
  if (!parsed.ok) return { errors: parsed.errors };

  const recipeId = String(formData.get("id") ?? "");
  const { data, error } = await supabase.rpc("save_recipe", {
    target_household_id: id,
    recipe: parsed.recipe,
    ingredients: parsed.ingredients,
    excluded_member_ids: parsed.excludedMemberIds,
    ...(recipeId ? { target_recipe_id: recipeId } : {}),
  });
  if (error) return { errors: { form: SAVE_ERROR } };

  redirect(`/recettes/${data}`);
}

// Supprime une recette du foyer (une copie du catalogue laisse réapparaître l'originale).
export async function deleteRecipe(formData: FormData) {
  const { supabase, household: { id } } = await household();
  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("household_id", id);
  if (error) throw new Error(SAVE_ERROR);
  redirect("/recettes");
}
