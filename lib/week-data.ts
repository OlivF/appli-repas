import type { PlannerCard, Protein } from "@/lib/planner";
import { householdRecipes, loadReadyHousehold, type ListRecipe } from "@/lib/recipes-data";

export type WeekRecipe = ListRecipe & { protein: Protein | null };
export type WeekCard = PlannerCard & { id: string };

type Client = Awaited<ReturnType<typeof loadReadyHousehold>>["supabase"];

// Les cartes d'une semaine, dans l'ordre de la grille.
export async function weekCards(supabase: Client, planId: string): Promise<WeekCard[]> {
  const { data, error } = await supabase
    .from("planned_meals")
    .select("id, day, meal_type, position, recipe_id, member_ids, locked")
    .eq("week_plan_id", planId)
    .order("day")
    .order("position");
  if (error) throw new Error(error.message);
  return data;
}

// Tout ce qu'il faut pour afficher et planifier la semaine qui commence le lundi `weekStart` :
// membres, créneaux, recettes (foyer + catalogue), la semaine enregistrée et ses cartes.
export async function loadWeek(weekStart: string) {
  const { supabase, household, members, slots } = await loadReadyHousehold();

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
  const cards = plan ? await weekCards(supabase, plan.id) : [];
  return { supabase, household, members, slots, recipes: recipes as WeekRecipe[], plan, cards };
}
