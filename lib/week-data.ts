import { weekChanges, weekSlots, type WeekOverride } from "@/lib/meal-slots";
import type { PlannerCard, Protein } from "@/lib/planner";
import { isExtra } from "@/lib/recipes";
import { householdRecipes, loadReadyHousehold, type ListRecipe } from "@/lib/recipes-data";

export type WeekRecipe = ListRecipe & { protein: Protein | null };
// `skipped` : « Pas cuisiné » (ses ingrédients restent au frigo au bilan de la semaine).
export type WeekCard = PlannerCard & { id: string; skipped?: boolean };

type Client = Awaited<ReturnType<typeof loadReadyHousehold>>["supabase"];

// Les cartes d'une semaine, dans l'ordre de la grille, avec la sorte de leur recette (un plat, ou
// un dessert, un fruit… qui ne compte pas dans « un plat par personne »).
export async function weekCards(supabase: Client, planId: string): Promise<WeekCard[]> {
  const { data, error } = await supabase
    .from("planned_meals")
    .select("id, day, meal_type, position, recipe_id, member_ids, locked, skipped, recipes(course)")
    .eq("week_plan_id", planId)
    .order("day")
    .order("position");
  if (error) throw new Error(error.message);
  return data.map(({ recipes, ...card }) => ({ ...card, course: recipes?.course ?? "main" }));
}

// Les repas changés pour une semaine (vide : pas de repas).
export async function weekOverrides(supabase: Client, planId: string): Promise<WeekOverride[]> {
  const { data, error } = await supabase
    .from("week_meal_overrides")
    .select("day, meal_type, member_ids")
    .eq("week_plan_id", planId);
  if (error) throw new Error(error.message);
  return data;
}

// Tout ce qu'il faut pour afficher et planifier la semaine qui commence le lundi `weekStart` :
// membres, repas, recettes (foyer + catalogue), la semaine enregistrée et ses cartes.
// `slots` : les repas qui ont lieu cette semaine (ceux du foyer, `homeSlots`, changés par les
// exceptions de la semaine, `overrides`) ; tout le planning les suit. `changes` : ce qui ne suit
// pas le foyer. `recipes` : les plats seulement (le planificateur, la Bibliothèque) ;
// `extraRecipes` : entrées, desserts, fruits, fromages et laitages (puces, panneau d'ajout).
export async function loadWeek(weekStart: string) {
  const { supabase, household, members, slots: homeSlots } = await loadReadyHousehold();

  const [recipes, planResult] = await Promise.all([
    householdRecipes(supabase, household.id),
    supabase
      .from("week_plans")
      .select("id, seed")
      .eq("household_id", household.id)
      .eq("week_start", weekStart)
      .maybeSingle(),
  ]);
  if (planResult.error) throw new Error(planResult.error.message);

  const plan = planResult.data;
  const [cards, overrides] = plan
    ? await Promise.all([weekCards(supabase, plan.id), weekOverrides(supabase, plan.id)])
    : [[], []];
  const all = recipes as WeekRecipe[];
  return {
    supabase,
    household,
    members,
    slots: weekSlots(homeSlots, overrides),
    homeSlots,
    overrides,
    changes: weekChanges(homeSlots, overrides),
    recipes: all.filter((recipe) => !isExtra(recipe.course)),
    extraRecipes: all.filter((recipe) => isExtra(recipe.course)),
    plan,
    cards,
  };
}
