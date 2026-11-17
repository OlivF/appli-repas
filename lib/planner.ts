import { MEAL_TYPES, type MealType } from "@/lib/meal-slots";
import type { Diet } from "@/lib/members";
import { incompatibleDiets, normalizeText, type GroceryAisle } from "@/lib/recipes";

// « Proposer la semaine » : code pur, sans base ni réseau, testé par lib/planner.test.ts.
// Règles et notes : docs/superpowers/specs/2026-11-17-semaine-design.md (section Algorithme).

// Famille de l'ingrédient principal (volaille, boeuf, porc, agneau, poisson), ou le nom
// normalisé d'une viande que l'on ne sait pas classer.
export type Protein = string;

export type PlannerMember = { id: string; diets: readonly Diet[] };

export type PlannerRecipe = {
  id: string;
  meal_types: readonly MealType[];
  diets: readonly Diet[];
  excludedIds: readonly string[];
  favorite: boolean;
  // Préparation + cuisson.
  minutes: number;
  protein: Protein | null;
};

export type PlannerSlot = { day: number; meal_type: MealType; member_ids: readonly string[] };

export type PlannerCard = {
  day: number;
  meal_type: MealType;
  position: number;
  recipe_id: string;
  member_ids: string[];
  locked: boolean;
};

export type Unfed = { day: number; meal_type: MealType; member_ids: string[] };

// ─── Ingrédient principal ───────────────────────────────────────────────────

const PROTEIN_KEYWORDS: [Protein, string[]][] = [
  ["volaille", ["poulet", "dinde", "canard", "pintade", "volaille", "caille"]],
  ["boeuf", ["boeuf", "veau", "steak", "bavette", "entrecote"]],
  ["porc", ["porc", "jambon", "lardon", "bacon", "saucisse", "chorizo", "chipolata", "echine"]],
  ["agneau", ["agneau", "mouton", "gigot"]],
  [
    "poisson",
    ["saumon", "thon", "cabillaud", "colin", "merlu", "poisson", "crevette", "truite", "sardine", "maquereau", "dorade", "moule"],
  ],
];

// Le premier ingrédient des rayons boucherie ou poissonnerie, rangé dans sa famille.
export function mainProtein(ingredients: readonly { name: string; aisle: GroceryAisle }[]): Protein | null {
  const main = ingredients.find((item) => item.aisle === "boucherie" || item.aisle === "poissonnerie");
  if (!main) return null;
  const name = normalizeText(main.name);
  const family = PROTEIN_KEYWORDS.find(([, words]) => words.some((word) => name.includes(word)));
  return family ? family[0] : name;
}

// ─── Qui peut manger quoi ───────────────────────────────────────────────────

export function canEat(recipe: PlannerRecipe, member: PlannerMember): boolean {
  return incompatibleDiets(recipe.diets, member.diets).length === 0 && !recipe.excludedIds.includes(member.id);
}

// ─── Notes ──────────────────────────────────────────────────────────────────

const WEEKEND_FIRST_DAY = 5;
const QUICK_MINUTES = 30;
const LONG_MINUTES = 45;
const JITTER = 1.5;

// Nombre d'apparitions permises dans la semaine.
function cap(mealType: MealType) {
  return mealType === "petit_dej" ? 2 : 1;
}

// Écart déterministe dans [0, JITTER) : hachage FNV-1a de (graine, recette, jour, repas).
function jitter(seed: number, recipeId: string, day: number, mealType: MealType) {
  let hash = 0x811c9dc5;
  for (const char of `${seed}|${recipeId}|${day}|${mealType}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) / 0x1_0000_0000) * JITTER;
}

type Week = {
  cards: PlannerCard[];
  recipes: Map<string, PlannerRecipe>;
  seed: number;
};

function score(recipe: PlannerRecipe, day: number, mealType: MealType, week: Week) {
  let points = 0;
  if (recipe.favorite) points += 3;

  if (day >= WEEKEND_FIRST_DAY) {
    if (recipe.minutes >= LONG_MINUTES) points += 2;
  } else if (recipe.minutes <= QUICK_MINUTES) {
    points += 2;
  } else {
    points -= Math.ceil((recipe.minutes - QUICK_MINUTES) / 15);
  }

  if (recipe.protein && mealType !== "petit_dej") {
    const sameFamilyNearby = week.cards.some(
      (card) =>
        card.meal_type !== "petit_dej" &&
        Math.abs(card.day - day) <= 1 &&
        week.recipes.get(card.recipe_id)?.protein === recipe.protein,
    );
    if (sameFamilyNearby) points -= 3;
  }

  if (mealType === "petit_dej" && week.cards.some((card) => card.recipe_id === recipe.id)) points -= 4;

  return points + jitter(week.seed, recipe.id, day, mealType);
}

function servedDays(recipeId: string, cards: readonly PlannerCard[]) {
  return cards.filter((card) => card.recipe_id === recipeId).map((card) => card.day);
}

// Encore permise : sous son plafond de la semaine, et pas servie la veille ni le lendemain.
function isAvailable(recipe: PlannerRecipe, day: number, mealType: MealType, cards: readonly PlannerCard[]) {
  const days = servedDays(recipe.id, cards);
  return days.length < cap(mealType) && !days.some((served) => Math.abs(served - day) === 1);
}

// Repli : déjà servie, pas la veille ni le lendemain ni le jour même ; rend le jour de son
// dernier service (le plus tôt passe en premier), ou null si elle ne peut pas revenir.
function fallbackDay(recipe: PlannerRecipe, day: number, cards: readonly PlannerCard[]) {
  const days = servedDays(recipe.id, cards);
  if (days.length === 0 || days.some((served) => Math.abs(served - day) <= 1)) return null;
  return Math.max(...days);
}

type Choice = { recipe: PlannerRecipe; eaters: string[] };

// La meilleure recette pour `remaining` dans ce créneau : la plus couvrante parmi les
// disponibles (à égalité, la meilleure note) ; sinon le repli.
function choose(
  remaining: readonly PlannerMember[],
  day: number,
  mealType: MealType,
  candidates: readonly PlannerRecipe[],
  week: Week,
): Choice | null {
  const options = candidates
    .map((recipe) => ({ recipe, eaters: remaining.filter((member) => canEat(recipe, member)).map((member) => member.id) }))
    .filter((option) => option.eaters.length > 0);

  const available = options
    .filter((option) => isAvailable(option.recipe, day, mealType, week.cards))
    .map((option) => ({ ...option, score: score(option.recipe, day, mealType, week) }))
    .sort((a, b) => b.eaters.length - a.eaters.length || b.score - a.score);
  if (available.length > 0) return available[0];

  const fallback = options
    .map((option) => ({
      ...option,
      lastDay: fallbackDay(option.recipe, day, week.cards),
      score: score(option.recipe, day, mealType, week),
    }))
    .filter((option) => option.lastDay !== null)
    .sort((a, b) => a.lastDay! - b.lastDay! || b.eaters.length - a.eaters.length || b.score - a.score);
  return fallback[0] ?? null;
}

const MEAL_ORDER = MEAL_TYPES.map((meal) => meal.value);

function bySlotOrder(a: { day: number; meal_type: MealType }, b: { day: number; meal_type: MealType }) {
  return a.day - b.day || MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type);
}

// ─── Proposer la semaine ────────────────────────────────────────────────────

// Rend les nouvelles cartes (non verrouillées) ; les cartes verrouillées restent telles quelles,
// leurs membres sont déjà servis et leurs recettes comptent comme servies.
export function proposeWeek(input: {
  slots: readonly PlannerSlot[];
  members: readonly PlannerMember[];
  recipes: readonly PlannerRecipe[];
  locked: readonly PlannerCard[];
  seed: number;
}): { cards: PlannerCard[]; unfed: Unfed[] } {
  const week: Week = {
    cards: [...input.locked],
    recipes: new Map(input.recipes.map((recipe) => [recipe.id, recipe])),
    seed: input.seed,
  };
  const members = new Map(input.members.map((member) => [member.id, member]));
  const created: PlannerCard[] = [];
  const unfed: Unfed[] = [];

  for (const { day, meal_type: mealType, member_ids: memberIds } of [...input.slots].sort(bySlotOrder)) {
    const here = input.locked.filter((card) => card.day === day && card.meal_type === mealType);
    const served = new Set(here.flatMap((card) => card.member_ids));
    let remaining = memberIds
      .filter((id) => !served.has(id))
      .map((id) => members.get(id))
      .filter((member): member is PlannerMember => member !== undefined);
    let position = here.reduce((next, card) => Math.max(next, card.position + 1), 0);
    const candidates = input.recipes.filter((recipe) => recipe.meal_types.includes(mealType));

    while (remaining.length > 0) {
      const choice = choose(remaining, day, mealType, candidates, week);
      if (!choice) {
        unfed.push({ day, meal_type: mealType, member_ids: remaining.map((member) => member.id) });
        break;
      }
      const card: PlannerCard = {
        day,
        meal_type: mealType,
        position: position++,
        recipe_id: choice.recipe.id,
        member_ids: choice.eaters,
        locked: false,
      };
      created.push(card);
      week.cards.push(card);
      remaining = remaining.filter((member) => !choice.eaters.includes(member.id));
    }
  }

  return { cards: created, unfed };
}

// ─── Autre idée ─────────────────────────────────────────────────────────────

// Une autre recette pour `card`, qui convient à tous ses mangeurs, ni l'actuelle ni une déjà
// essayée. `cards` : les autres cartes de la semaine (sans celle-ci).
export function nextIdea(input: {
  card: PlannerCard;
  cards: readonly PlannerCard[];
  members: readonly PlannerMember[];
  recipes: readonly PlannerRecipe[];
  tried: readonly string[];
  seed: number;
}): string | null {
  const { card } = input;
  const eaters = input.members.filter((member) => card.member_ids.includes(member.id));
  const excluded = new Set([card.recipe_id, ...input.tried]);
  const candidates = input.recipes.filter(
    (recipe) =>
      recipe.meal_types.includes(card.meal_type) &&
      !excluded.has(recipe.id) &&
      eaters.every((member) => canEat(recipe, member)),
  );
  const week: Week = {
    cards: [...input.cards],
    recipes: new Map(input.recipes.map((recipe) => [recipe.id, recipe])),
    seed: input.seed,
  };
  return choose(eaters, card.day, card.meal_type, candidates, week)?.recipe.id ?? null;
}
