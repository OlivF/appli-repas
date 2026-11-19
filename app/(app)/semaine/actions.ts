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
// « Autre idée » sur un duo change aussi l'autre plat : `cards` rend les cartes changées.
export type IdeaResult = { cards: WeekCard[] } | { none: true } | ActionError;
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

export type CardsResult = { cards: WeekCard[] } | ActionError;

const NOBODY = "Touche d’abord qui mange ce plat.";

type Client = Awaited<ReturnType<typeof loadWeek>>["supabase"];

// Toutes les cartes de la semaine, après un geste qui en change plusieurs.
async function cardsOfWeek(supabase: Client, householdId: string, weekStart: string): Promise<WeekCard[]> {
  const { data, error } = await supabase
    .from("week_plans")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? weekCards(supabase, data.id) : [];
}

// « + Ajouter un plat » : une recette pour certains présents du repas, qui quittent le plat
// qu'ils avaient (un plat vidé disparaît). Le plat ajouté se verrouille.
export async function addDishAction(
  weekStart: string,
  target: { day: number; meal_type: MealType },
  recipeId: string,
  memberIds: string[],
): Promise<CardsResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, household, slots, recipes } = await loadWeek(weekStart);
  const slot = slots.find((item) => item.day === target.day && item.meal_type === target.meal_type);
  const recipe = recipes.find((item) => item.id === recipeId);
  if (!slot || !recipe) return { error: SAVE_ERROR };
  if (!recipe.meal_types.includes(slot.meal_type)) return { error: WRONG_MEAL };
  const eaters = memberIds.filter((id) => slot.member_ids.includes(id));
  if (eaters.length === 0) return { error: NOBODY };

  const { error } = await supabase.rpc("add_planned_meal", {
    target_household_id: household.id,
    target_week_start: weekStart,
    target_day: slot.day,
    target_meal_type: slot.meal_type,
    target_recipe_id: recipeId,
    eater_ids: eaters,
  });
  if (error) return { error: SAVE_ERROR };
  return { cards: await cardsOfWeek(supabase, household.id, weekStart) };
}

// « Qui mange ce plat ? » : les présents cochés passent sur ce plat et quittent les autres
// plats du repas (un plat vidé disparaît). Le plat se verrouille.
export async function setEatersAction(weekStart: string, cardId: string, memberIds: string[]): Promise<CardsResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, household, slots, cards } = await loadWeek(weekStart);
  const card = cards.find((item) => item.id === cardId);
  if (!card) return { error: SAVE_ERROR };
  const present =
    slots.find((item) => item.day === card.day && item.meal_type === card.meal_type)?.member_ids ?? card.member_ids;
  const eaters = memberIds.filter((id) => present.includes(id));
  if (eaters.length === 0) return { error: NOBODY };

  const { error } = await supabase.rpc("set_planned_meal_eaters", { target_card_id: cardId, eater_ids: eaters });
  if (error) return { error: SAVE_ERROR };
  return { cards: await cardsOfWeek(supabase, household.id, weekStart) };
}

// « Retirer ce plat » : ses mangeurs n'ont plus rien de prévu (« Rien de prévu pour … »).
export async function removeCardAction(weekStart: string, cardId: string): Promise<DoneResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, cards } = await loadWeek(weekStart);
  if (!cards.some((card) => card.id === cardId)) return { error: SAVE_ERROR };
  const { error } = await supabase.from("planned_meals").delete().eq("id", cardId);
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
// ni une de `tried` (déjà proposées pour cette carte). Sur un duo de même base, l'autre plat
// change aussi quand il est libre (voir nextIdea).
export async function anotherIdeaAction(weekStart: string, cardId: string, tried: string[]): Promise<IdeaResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, members, recipes, plan, cards } = await loadWeek(weekStart);
  const card = cards.find((item) => item.id === cardId);
  if (!card) return { error: SAVE_ERROR };
  if (card.locked) return { error: LOCKED };

  const idea = nextIdea({
    card,
    cards: cards.filter((item) => item.id !== cardId),
    members,
    recipes,
    tried,
    seed: plan?.seed ?? 0,
  });
  if (!idea) return { none: true };

  const changed = [
    { ...card, recipe_id: idea.recipe_id },
    ...(idea.partner ? [{ ...idea.partner.card, recipe_id: idea.partner.recipe_id }] : []),
  ];
  for (const item of changed) {
    const { error } = await supabase.from("planned_meals").update({ recipe_id: item.recipe_id }).eq("id", item.id);
    if (error) return { error: SAVE_ERROR };
  }
  return { cards: changed };
}
