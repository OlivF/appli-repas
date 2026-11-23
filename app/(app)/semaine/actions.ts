"use server";

import { clearableCards, extrasToAdd, restorableEaters, type ExtraTarget, type Unserved } from "@/lib/board";
import { SAVE_ERROR } from "@/lib/data";
import { MEAL_TYPES, type MealType, type SlotInput, type WeekChange } from "@/lib/meal-slots";
import { nextIdea, proposeWeek } from "@/lib/planner";
import { quickRecipe, type QuickRecipeInput } from "@/lib/quick-recipe";
import { AISLES, courseOf, isExtra } from "@/lib/recipes";
import { loadReadyHousehold } from "@/lib/recipes-data";
import { mondayOf } from "@/lib/week";
import { loadWeek, weekCards, type WeekCard, type WeekRecipe } from "@/lib/week-data";

// Chaque geste du planning est enregistré aussitôt. Les actions rendent ce que l'écran ne
// peut pas deviner (cartes proposées, recette trouvée, carte créée), ou une erreur.

export type ActionError = { error: string };
export type ProposeResult = { cards: WeekCard[] } | ActionError;
export type CardResult = { card: WeekCard } | ActionError;
// « Autre idée » sur un duo change aussi l'autre plat : `cards` rend les cartes changées.
export type IdeaResult = { cards: WeekCard[] } | { none: true } | ActionError;
export type DoneResult = { ok: true } | ActionError;

const WRONG_MEAL = "Cette recette ne va pas à ce repas.";
const NOT_A_DISH = "Un dessert, un fruit ou une entrée se change depuis sa puce.";
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

// « Pas cuisiné » : au bilan de la semaine, ses ingrédients ne sont pas retirés du frigo.
export async function setSkippedAction(weekStart: string, cardId: string, skipped: boolean): Promise<DoneResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, cards } = await loadWeek(weekStart);
  if (!cards.some((card) => card.id === cardId)) return { error: SAVE_ERROR };
  const { error } = await supabase.from("planned_meals").update({ skipped }).eq("id", cardId);
  return error ? { error: SAVE_ERROR } : { ok: true };
}

// Échange les recettes de deux cartes ; chacune doit aller au repas de l'autre.
export async function swapCardsAction(weekStart: string, firstId: string, secondId: string): Promise<DoneResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, cards, recipes } = await loadWeek(weekStart);
  const first = cards.find((card) => card.id === firstId);
  const second = cards.find((card) => card.id === secondId);
  if (!first || !second) return { error: SAVE_ERROR };
  if (isExtra(first.course) || isExtra(second.course)) return { error: NOT_A_DISH };
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

const RESTORE_NONE = "Ce plat ne peut plus revenir : tout le monde a déjà un plat à ce repas.";

// « Annuler » après la corbeille : la carte revient telle qu'elle était (jour, repas, position,
// recette, verrou, « Pas cuisiné »), pour ses mangeurs encore présents qui n'ont pas pris un autre
// plat entre-temps (un plat léger : tous ses présents). Un plat léger déjà remis au repas reçoit
// ses mangeurs, sans doublon. La sorte vient de la recette, pas de l'écran.
export async function restoreCardAction(weekStart: string, card: WeekCard): Promise<CardsResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  if (!card || !Number.isInteger(card.day) || card.day < 0 || card.day > 6) return { error: SAVE_ERROR };
  if (!MEAL_TYPES.some((meal) => meal.value === card.meal_type) || !Array.isArray(card.member_ids)) {
    return { error: SAVE_ERROR };
  }
  const { supabase, household, slots, recipes, extraRecipes, plan, cards } = await loadWeek(weekStart);
  const recipe = [...recipes, ...extraRecipes].find((item) => item.id === card.recipe_id);
  if (!plan || !recipe) return { error: SAVE_ERROR };

  const restored = { ...card, course: recipe.course };
  const presentIds = slots.find((slot) => slot.day === card.day && slot.meal_type === card.meal_type)?.member_ids ?? [];
  const eaters = restorableEaters({ card: restored, cards, presentIds });
  if (eaters.length === 0) return { error: RESTORE_NONE };

  const twin = isExtra(recipe.course)
    ? cards.find((item) => item.day === card.day && item.meal_type === card.meal_type && item.recipe_id === recipe.id)
    : undefined;
  const { error } = twin
    ? await supabase
        .from("planned_meals")
        .update({ member_ids: [...twin.member_ids, ...eaters.filter((id) => !twin.member_ids.includes(id))] })
        .eq("id", twin.id)
    : await supabase.from("planned_meals").insert({
        household_id: household.id,
        week_plan_id: plan.id,
        day: card.day,
        meal_type: card.meal_type,
        position: Number.isInteger(card.position) && card.position >= 0 ? card.position : 0,
        recipe_id: recipe.id,
        member_ids: eaters,
        locked: Boolean(card.locked),
        skipped: Boolean(card.skipped),
      });
  if (error) return { error: SAVE_ERROR };
  return { cards: await cardsOfWeek(supabase, household.id, weekStart) };
}

export type ClearResult = { cards: WeekCard[]; removed: number } | ActionError;

// « Vider la semaine » : les plats non verrouillés partent ; les plats verrouillés et les à-côtés
// (entrées, desserts, fruits…) restent. Un plat qu'un autre compte verrouille juste avant la
// suppression reste aussi (« locked = false » dans la suppression même). Rend les cartes de la
// semaine et le nombre de plats vraiment retirés.
export async function clearWeekAction(weekStart: string): Promise<ClearResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, plan, cards } = await loadWeek(weekStart);
  if (!plan) return { cards: [], removed: 0 };
  const ids = clearableCards(cards).map((card) => card.id);
  if (ids.length === 0) return { cards, removed: 0 };
  const { data, error } = await supabase
    .from("planned_meals")
    .delete()
    .in("id", ids)
    .eq("locked", false)
    .select("id");
  if (error) return { error: SAVE_ERROR };
  return { cards: await weekCards(supabase, plan.id), removed: data.length };
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
    if (isExtra(card.course)) return { error: NOT_A_DISH };
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
  if (isExtra(card.course)) return { error: NOT_A_DISH };
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

// ─── Les repas d'une semaine ────────────────────────────────────────────────

export type WeekMealsResult = { slots: SlotInput[]; changes: WeekChange[]; cards: WeekCard[] } | ActionError;

async function weekMeals(weekStart: string): Promise<WeekMealsResult> {
  const { slots, changes, cards } = await loadWeek(weekStart);
  return { slots, changes, cards };
}

// « Qui est là ? » pour un repas, cette semaine seulement : les présents cochés (personne : pas de
// repas ; ceux du foyer : comme d'habitude). Les plats du repas ne gardent que les présents.
// Rend les repas de la semaine et ses cartes.
export async function setWeekMealAction(
  weekStart: string,
  day: number,
  mealType: MealType,
  memberIds: string[],
): Promise<WeekMealsResult> {
  if (!isWeekStart(weekStart) || !Number.isInteger(day) || day < 0 || day > 6) return { error: SAVE_ERROR };
  if (!MEAL_TYPES.some((meal) => meal.value === mealType) || !Array.isArray(memberIds)) return { error: SAVE_ERROR };
  const { supabase, household, members } = await loadReadyHousehold();
  const present = members.filter((member) => memberIds.includes(member.id)).map((member) => member.id);
  const { error } = await supabase.rpc("set_week_meal", {
    target_household_id: household.id,
    target_week_start: weekStart,
    target_day: day,
    target_meal_type: mealType,
    eater_ids: present,
  });
  if (error) return { error: SAVE_ERROR };
  return weekMeals(weekStart);
}

// « Tout remettre comme d'habitude » : la semaine suit à nouveau le foyer.
export async function resetWeekMealsAction(weekStart: string): Promise<WeekMealsResult> {
  if (!isWeekStart(weekStart)) return { error: SAVE_ERROR };
  const { supabase, household } = await loadReadyHousehold();
  const { error } = await supabase.rpc("reset_week_meals", {
    target_household_id: household.id,
    target_week_start: weekStart,
  });
  if (error) return { error: SAVE_ERROR };
  return weekMeals(weekStart);
}

// ─── Desserts, fruits, fromages ─────────────────────────────────────────────

export type ExtrasResult = { cards: WeekCard[]; meals: number; unserved: Unserved[] } | ActionError;

function isTarget(target: ExtraTarget) {
  const day = "day" in target ? target.day : target.fromDay;
  return Number.isInteger(day) && day >= 0 && day <= 6 && MEAL_TYPES.some((meal) => meal.value === target.meal_type);
}

// « Ajouter » dans le panneau « Dessert, fruit… » : chaque recette pour les présents cochés qui
// peuvent la manger, sur ce repas ou sur tous les repas de ce type à partir de `fromDay` ; une
// recette déjà au repas fusionne ses mangeurs. Rend toutes les cartes, le nombre de repas
// touchés (pour le toast) et, par repas, les cochés qui n'ont rien pu avoir (« Et pour … ? »).
export async function addExtrasAction(
  weekStart: string,
  target: ExtraTarget,
  recipeIds: string[],
  memberIds: string[],
): Promise<ExtrasResult> {
  if (!isWeekStart(weekStart) || !isTarget(target) || recipeIds.length === 0) return { error: SAVE_ERROR };
  const { supabase, household, members, slots, extraRecipes, cards } = await loadWeek(weekStart);
  const recipes = recipeIds.map((id) => extraRecipes.find((recipe) => recipe.id === id));
  if (recipes.some((recipe) => recipe === undefined)) return { error: SAVE_ERROR };
  if (recipes.some((recipe) => !recipe!.meal_types.includes(target.meal_type))) return { error: WRONG_MEAL };

  const { items, unserved } = extrasToAdd({
    recipes: recipes as WeekRecipe[],
    eaterIds: memberIds,
    target,
    slots,
    cards,
    members,
  });
  if (items.length > 0) {
    const { error } = await supabase.rpc("add_planned_extras", {
      target_household_id: household.id,
      target_week_start: weekStart,
      items: items.map(({ day, meal_type, recipe_id, member_ids }) => ({ day, meal_type, recipe_id, member_ids })),
    });
    if (error) return { error: SAVE_ERROR };
  }
  return {
    cards: await cardsOfWeek(supabase, household.id, weekStart),
    meals: new Set(items.map((item) => `${item.day}:${item.meal_type}`)).size,
    unserved,
  };
}

export type QuickRecipeResult = { recipe: WeekRecipe } | ActionError;

// « Créer « Clafoutis » » : une recette du foyer, légère (un ingrédient, une portion) ou avec son
// titre seulement (dessert, entrée), prête à cocher dans le panneau.
export async function createQuickRecipeAction(input: QuickRecipeInput): Promise<QuickRecipeResult> {
  const { supabase, household } = await loadReadyHousehold();
  const parsed = quickRecipe({
    ...input,
    title: String(input.title ?? ""),
    course: courseOf(input.course).value,
    aisle: AISLES.find((aisle) => aisle.value === input.aisle)?.value,
    diets: Array.isArray(input.diets) ? input.diets : [],
  });
  if (!parsed.ok) return { error: parsed.error };

  const { data: id, error } = await supabase.rpc("save_recipe", {
    target_household_id: household.id,
    recipe: parsed.recipe,
    ingredients: parsed.ingredients,
    excluded_member_ids: [],
  });
  if (error || !id) return { error: SAVE_ERROR };
  const { data: lines, error: linesError } = await supabase
    .from("recipe_ingredients")
    .select("ingredient_id")
    .eq("recipe_id", id);
  if (linesError) return { error: SAVE_ERROR };

  const { recipe, ingredients } = parsed;
  return {
    recipe: {
      id,
      title: recipe.title,
      photo_url: null,
      meal_types: recipe.meal_types,
      minutes: 0,
      diets: recipe.diets,
      batch_friendly: false,
      ingredientNames: ingredients.map((ingredient) => ingredient.name),
      favorite: false,
      excludedIds: [],
      base: null,
      basic: false,
      course: recipe.course,
      servings: recipe.servings,
      ingredientIds: lines.flatMap((line) => (line.ingredient_id ? [line.ingredient_id] : [])),
      protein: null,
    },
  };
}
