import { settleWeek, type FridgeItem } from "@/lib/fridge";
import type { PortionMember } from "@/lib/portions";
import { loadMenuRecipes } from "@/lib/shopping-data";
import { weekNeeds, type ShoppingMeal } from "@/lib/shopping";
import type { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/week";

type Client = Awaited<ReturnType<typeof createClient>>;

// Le bilan des semaines finies (dimanche passé) dont la liste n'est pas encore soldée : on
// retire du frigo ce que les plats cuisinés ont consommé (lib/fridge.ts, settleWeek), puis ce
// qui restait réservé redevient libre (apply_fridge_settlement, une seule fois même si deux
// téléphones ouvrent l'appli en même temps). Appelé au chargement de /frigo, /courses et
// /semaine ; silencieux : une erreur n'empêche pas la page de s'afficher.
export async function settleFinishedWeeks(
  supabase: Client,
  householdId: string,
  members: readonly PortionMember[],
  today: string,
): Promise<number> {
  try {
    const { data: lists, error } = await supabase
      .from("shopping_lists")
      .select("id, week_plans(id, week_start)")
      .eq("household_id", householdId)
      .is("settled_at", null);
    if (error) throw new Error(error.message);

    const finished = lists
      .flatMap((list) => {
        const plan = Array.isArray(list.week_plans) ? list.week_plans[0] : list.week_plans;
        return plan && addDays(plan.week_start, 6) < today ? [{ listId: list.id, planId: plan.id, weekStart: plan.week_start }] : [];
      })
      .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
    if (finished.length === 0) return 0;

    let settled = 0;
    for (const week of finished) {
      if (await settleWeekList(supabase, householdId, members, week)) settled++;
    }
    return settled;
  } catch (error) {
    console.error("Bilan du frigo", error);
    return 0;
  }
}

async function settleWeekList(
  supabase: Client,
  householdId: string,
  members: readonly PortionMember[],
  { listId, planId, weekStart }: { listId: string; planId: string; weekStart: string },
): Promise<boolean> {
  const [mealsResult, itemsResult, fridgeResult] = await Promise.all([
    supabase.from("planned_meals").select("day, meal_type, recipe_id, member_ids, skipped").eq("week_plan_id", planId),
    supabase.from("shopping_items").select("ingredient_id, from_fridge").eq("list_id", listId).gt("from_fridge", 0),
    supabase
      .from("fridge_items")
      .select("id, ingredient_id, label, quantity, unit, best_before, origin, recipe_id, reserved_list_id")
      .eq("household_id", householdId),
  ]);
  for (const result of [mealsResult, itemsResult, fridgeResult]) if (result.error) throw new Error(result.error.message);

  const meals: ShoppingMeal[] = mealsResult.data ?? [];
  const { recipes, ingredients } = await loadMenuRecipes(supabase, meals);
  const needs = weekNeeds({ meals, recipes, members, ingredients, weekStart });

  const fromFridge: Record<string, number> = {};
  for (const item of itemsResult.data ?? []) {
    if (item.ingredient_id) fromFridge[item.ingredient_id] = (fromFridge[item.ingredient_id] ?? 0) + Number(item.from_fridge);
  }
  const items: FridgeItem[] = (fridgeResult.data ?? []).map((item) => ({
    ...item,
    quantity: item.quantity === null ? null : Number(item.quantity),
  }));

  const { data, error } = await supabase.rpc("apply_fridge_settlement", {
    target_list_id: listId,
    changes: settleWeek({ items, listId, fromFridge, needs }),
  });
  if (error) throw new Error(error.message);
  return data;
}
