"use server";

import { SAVE_ERROR } from "@/lib/data";
import type { MealType } from "@/lib/meal-slots";
import { nextIdea, proposeWeek } from "@/lib/planner";
import { mondayOf } from "@/lib/week";
import { loadWeek, weekCards, type WeekCard } from "@/lib/week-data";

// Chaque geste du planning est enregistré aussitôt. Les actions rendent ce que l'écran ne
// peut pas deviner (cartes proposées, recette trouvée, carte créée), ou une erreur.

export type ActionError = { error: string };
export type ProposeResult = { cards: WeekCard[] } | ActionError;
export type CardResult = { card: WeekCard } | ActionError;
export type IdeaResult = { card: WeekCard } | { none: true } | ActionError;
export type DoneResult = { ok: true } | ActionError;

const WRONG_MEAL = "Cette recette ne va pas à ce repas.";
const LOCKED = "Ce plat est verrouillé : ouvre le cadenas pour le changer.";

function isWeekStart(text: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && mondayOf(text) === text;
}

// « Proposer la semaine » / « Relancer » : nouvelle graine, les cartes verrouillées restent.
export async function proposeWeekAction(weekStart: string): Promise<ProposeResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, household, members, slots, recipes, plan, cards } = await loadWeek(weekStart);

  const seed = (plan?.seed ?? 0) + 1;
  const proposal = proposeWeek({ slots, members, recipes, locked: cards.filter((card) => card.locked), seed });
  const { data: planId, error } = await supabase.rpc("save_week_proposal", {
    target_household_id: household.id,
    target_week_start: weekStart,
    new_seed: seed,
    cards: proposal.cards.map(({ day, meal_type, position, recipe_id, member_ids }) => ({
      day,
      meal_type,
      position,
      recipe_id,
      member_ids,
    })),
  });
  if (error || !planId) return { error: SAVE_ERROR };
  return { cards: await weekCards(supabase, planId) };
}

export async function toggleLockAction(weekStart: string, cardId: string, locked: boolean): Promise<DoneResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, cards } = await loadWeek(weekStart);
  if (!cards.some((card) => card.id === cardId)) return { error: SAVE_ERROR };
  const { error } = await supabase.from("planned_meals").update({ locked }).eq("id", cardId);
  return error ? { error: SAVE_ERROR } : { ok: true };
}

// Échange les recettes de deux cartes ; chacune doit aller au repas de l'autre.
export async function swapCardsAction(weekStart: string, firstId: string, secondId: string): Promise<DoneResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, cards, recipes } = await loadWeek(weekStart);
  const first = cards.find((card) => card.id === firstId);
  const second = cards.find((card) => card.id === secondId);
  if (!first || !second) return { error: SAVE_ERROR };
  if (first.locked || second.locked) return { error: LOCKED };
  const fits = (card: WeekCard, mealType: MealType) =>
    recipes.find((recipe) => recipe.id === card.recipe_id)?.meal_types.includes(mealType) ?? false;
  if (!fits(first, second.meal_type) || !fits(second, first.meal_type)) return { error: WRONG_MEAL };

  const { error } = await supabase.rpc("swap_planned_meals", { first_id: firstId, second_id: secondId });
  return error ? { error: SAVE_ERROR } : { ok: true };
}

export type PlaceTarget = { cardId: string } | { day: number; meal_type: MealType; member_ids?: string[] };

// Pose une recette choisie à la main : à la place d'une carte (même verrouillée : on l'a
// choisie exprès), ou dans un créneau (pour tous ses présents, ou pour `member_ids`).
// Elle se verrouille, pour qu'un « Relancer » la garde.
export async function placeRecipeAction(weekStart: string, target: PlaceTarget, recipeId: string): Promise<CardResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, household, slots, recipes, plan, cards } = await loadWeek(weekStart);
  const recipe = recipes.find((item) => item.id === recipeId);
  if (!recipe) return { error: SAVE_ERROR };

  if ("cardId" in target) {
    const card = cards.find((item) => item.id === target.cardId);
    if (!card) return { error: SAVE_ERROR };
    if (!recipe.meal_types.includes(card.meal_type)) return { error: WRONG_MEAL };
    const { error } = await supabase
      .from("planned_meals")
      .update({ recipe_id: recipeId, locked: true })
      .eq("id", card.id);
    return error ? { error: SAVE_ERROR } : { card: { ...card, recipe_id: recipeId, locked: true } };
  }

  const slot = slots.find((item) => item.day === target.day && item.meal_type === target.meal_type);
  if (!slot) return { error: SAVE_ERROR };
  if (!recipe.meal_types.includes(slot.meal_type)) return { error: WRONG_MEAL };
  const memberIds = target.member_ids?.filter((id) => slot.member_ids.includes(id)) ?? slot.member_ids;
  if (memberIds.length === 0) return { error: SAVE_ERROR };

  let planId = plan?.id;
  if (!planId) {
    const { data, error } = await supabase
      .from("week_plans")
      .insert({ household_id: household.id, week_start: weekStart })
      .select("id")
      .single();
    if (error) return { error: SAVE_ERROR };
    planId = data.id;
  }

  const position = cards
    .filter((card) => card.day === slot.day && card.meal_type === slot.meal_type)
    .reduce((next, card) => Math.max(next, card.position + 1), 0);
  const { data, error } = await supabase
    .from("planned_meals")
    .insert({
      household_id: household.id,
      week_plan_id: planId,
      day: slot.day,
      meal_type: slot.meal_type,
      position,
      recipe_id: recipeId,
      member_ids: memberIds,
      locked: true,
    })
    .select("id, day, meal_type, position, recipe_id, member_ids, locked")
    .single();
  return error ? { error: SAVE_ERROR } : { card: data };
}

// « Autre idée » : une recette qui convient à tous les mangeurs de la carte, ni l'actuelle
// ni une de `tried` (déjà proposées pour cette carte).
export async function anotherIdeaAction(weekStart: string, cardId: string, tried: string[]): Promise<IdeaResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, members, recipes, plan, cards } = await loadWeek(weekStart);
  const card = cards.find((item) => item.id === cardId);
  if (!card) return { error: SAVE_ERROR };
  if (card.locked) return { error: LOCKED };

  const recipeId = nextIdea({
    card,
    cards: cards.filter((item) => item.id !== cardId),
    members,
    recipes,
    tried,
    seed: plan?.seed ?? 0,
  });
  if (!recipeId) return { none: true };

  const { error } = await supabase.from("planned_meals").update({ recipe_id: recipeId }).eq("id", cardId);
  return error ? { error: SAVE_ERROR } : { card: { ...card, recipe_id: recipeId } };
}
