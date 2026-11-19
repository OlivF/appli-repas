import { baseKey } from "@/lib/bases";
import { MEAL_TYPES, type MealType } from "@/lib/meal-slots";
import type { Diet } from "@/lib/members";
import { incompatibleDiets, normalizeText, type GroceryAisle } from "@/lib/recipes";

// « Proposer la semaine » : code pur, sans base ni réseau, testé par lib/planner.test.ts.
// Règles et notes : docs/superpowers/specs/2026-11-17-semaine-design.md (section Algorithme),
// et 2026-11-19-plusieurs-plats-design.md (plusieurs plats par repas).

// ─── Réglages ───────────────────────────────────────────────────────────────
// Pour chaque repas, la proposition compare des solutions entières : un plat pour tous, un plat
// par groupe de régimes, un duo par base. Note d'une solution = moyenne des notes de ses plats,
// plus ces bonus et pénalités :
// tous les plats du repas (verrouillés compris) ont la même base…
export const SAME_BASE_BONUS = 5;
// …sinon la même famille de protéine ;
export const SAME_PROTEIN_BONUS = 2;
// par plat céto servi à quelqu'un qui n'est pas céto (la famille en mange de temps en temps) ;
export const KETO_FOR_OTHERS_PENALTY = 3;
// par plat au-delà du premier (à note égale, un plat unique reste plus simple) ;
export const EXTRA_CARD_PENALTY = 1;
// par repas de la semaine qui a déjà servi cette base (variété).
export const BASE_REPEAT_PENALTY = 3;

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
  // Élément principal, tel que saisi (le planificateur le compare normalisé).
  base: string | null;
  // Recette du panneau « Les basiques » : proposée seulement en duo avec un plat de sa base.
  basic?: boolean;
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
    // Les plats du même repas ne comptent pas : un duo partage exprès sa viande.
    const sameFamilyNearby = week.cards.some(
      (card) =>
        card.meal_type !== "petit_dej" &&
        Math.abs(card.day - day) <= 1 &&
        !(card.day === day && card.meal_type === mealType) &&
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

// ─── Solutions entières ─────────────────────────────────────────────────────

type Dish = { recipe: PlannerRecipe; eaters: PlannerMember[] };

const isKeto = (recipe: PlannerRecipe) => recipe.diets.includes("keto");
const ketoForOthers = (recipe: PlannerRecipe, eaters: readonly PlannerMember[]) =>
  isKeto(recipe) && eaters.some((member) => !member.diets.includes("keto"));

// Les présents regroupés par régimes identiques, dans l'ordre du créneau.
function dietGroups(members: readonly PlannerMember[]): PlannerMember[][] {
  const groups = new Map<string, PlannerMember[]>();
  for (const member of members) {
    const key = [...member.diets].sort().join(",");
    groups.set(key, [...(groups.get(key) ?? []), member]);
  }
  return [...groups.values()];
}

// Une recette différente par groupe, la meilleure pour lui (céto pour des non-céto pénalisé) ;
// les groupes les moins bien servis choisissent d'abord. Rend les plats dans l'ordre des groupes.
function onePerGroup(
  groups: readonly (readonly PlannerMember[])[],
  pool: readonly PlannerRecipe[],
  day: number,
  mealType: MealType,
  week: Week,
): Dish[] | null {
  const options = groups.map((group) => pool.filter((recipe) => group.every((member) => canEat(recipe, member))));
  const order = groups.map((_, index) => index).sort((a, b) => options[a].length - options[b].length || a - b);
  const rank = (recipe: PlannerRecipe, group: readonly PlannerMember[]) =>
    score(recipe, day, mealType, week) - (ketoForOthers(recipe, group) ? KETO_FOR_OTHERS_PENALTY : 0);
  const picked: Dish[] = [];
  const used = new Set<string>();
  for (const index of order) {
    const best = options[index]
      .filter((recipe) => !used.has(recipe.id))
      .map((recipe) => ({ recipe, rank: rank(recipe, groups[index]) }))
      .sort((a, b) => b.rank - a.rank)[0];
    if (!best) return null;
    used.add(best.recipe.id);
    picked[index] = { recipe: best.recipe, eaters: [...groups[index]] };
  }
  return picked;
}

// Repas de la semaine (hors celui-ci) qui ont déjà servi la base `key`.
function baseUses(key: string, day: number, mealType: MealType, week: Week) {
  const meals = new Set(
    week.cards
      .filter((card) => !(card.day === day && card.meal_type === mealType))
      .filter((card) => baseKey(week.recipes.get(card.recipe_id)?.base) === key)
      .map((card) => `${card.day}:${card.meal_type}`),
  );
  return meals.size;
}

function solutionScore(
  dishes: readonly Dish[],
  locked: readonly PlannerRecipe[],
  day: number,
  mealType: MealType,
  week: Week,
) {
  let total = dishes.reduce((sum, dish) => sum + score(dish.recipe, day, mealType, week), 0) / dishes.length;

  const all = [...locked, ...dishes.map((dish) => dish.recipe)];
  if (all.length >= 2) {
    const bases = all.map((recipe) => baseKey(recipe.base));
    if (bases[0] && bases.every((base) => base === bases[0])) total += SAME_BASE_BONUS;
    else if (all[0].protein && all.every((recipe) => recipe.protein === all[0].protein)) total += SAME_PROTEIN_BONUS;
  }
  for (const dish of dishes) if (ketoForOthers(dish.recipe, dish.eaters)) total -= KETO_FOR_OTHERS_PENALTY;
  total -= EXTRA_CARD_PENALTY * (dishes.length - 1);
  const bases = new Set(dishes.map((dish) => baseKey(dish.recipe.base)).filter((base) => base !== null));
  for (const base of bases) total -= BASE_REPEAT_PENALTY * baseUses(base, day, mealType, week);
  return total;
}

const baseOptions = (recipes: readonly PlannerRecipe[]) =>
  [...new Set(recipes.map((recipe) => baseKey(recipe.base)).filter((base) => base !== null))].sort();

// La meilleure solution entière pour `remaining` dans ce repas, à côté des plats verrouillés
// `locked` : un plat pour tous, un plat par groupe de régimes, ou un duo par base. Une basique
// n'entre que dans une solution où un autre plat du repas a sa base. Rien si aucune ne sert
// tout le monde (l'algorithme carte par carte prend le relais).
function bestSolution(
  remaining: readonly PlannerMember[],
  locked: readonly PlannerRecipe[],
  day: number,
  mealType: MealType,
  recipes: readonly PlannerRecipe[],
  week: Week,
): Dish[] | null {
  const lockedBases = new Set(locked.map((recipe) => baseKey(recipe.base)).filter((base) => base !== null));
  const pool = recipes.filter(
    (recipe) => recipe.meal_types.includes(mealType) && isAvailable(recipe, day, mealType, week.cards),
  );
  const plain = pool.filter((recipe) => !recipe.basic || lockedBases.has(baseKey(recipe.base) ?? ""));
  const groups = dietGroups(remaining);

  const solutions: Dish[][] = [];
  const forAll = onePerGroup([remaining], plain, day, mealType, week);
  if (forAll) solutions.push(forAll);
  if (groups.length >= 2) {
    const perGroup = onePerGroup(groups, plain, day, mealType, week);
    if (perGroup) solutions.push(perGroup);
  }
  for (const base of baseOptions(pool)) {
    if (groups.length < 2 && !lockedBases.has(base)) continue;
    const duo = onePerGroup(groups, pool.filter((recipe) => baseKey(recipe.base) === base), day, mealType, week);
    if (duo) solutions.push(duo);
  }

  return (
    solutions
      .map((dishes) => ({ dishes, score: solutionScore(dishes, locked, day, mealType, week) }))
      .sort((a, b) => b.score - a.score)[0]?.dishes ?? null
  );
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
    const candidates = input.recipes.filter((recipe) => !recipe.basic && recipe.meal_types.includes(mealType));

    const lockedRecipes = here
      .map((card) => week.recipes.get(card.recipe_id))
      .filter((recipe): recipe is PlannerRecipe => recipe !== undefined);
    const solution =
      remaining.length > 0 ? bestSolution(remaining, lockedRecipes, day, mealType, input.recipes, week) : null;
    for (const dish of solution ?? []) {
      const card: PlannerCard = {
        day,
        meal_type: mealType,
        position: position++,
        recipe_id: dish.recipe.id,
        member_ids: dish.eaters.map((member) => member.id),
        locked: false,
      };
      created.push(card);
      week.cards.push(card);
    }
    if (solution) remaining = [];

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

export type Idea<C extends PlannerCard = PlannerCard> = {
  recipe_id: string;
  // Sur un duo : la nouvelle recette de l'autre plat.
  partner?: { card: C; recipe_id: string };
};

// Une autre recette pour `card`, ni l'actuelle ni une déjà essayée (`tried`). `cards` : les
// autres cartes de la semaine. Sur un duo (un autre plat du repas a la même base) : l'autre plat
// libre → un nouveau duo pour les deux, sur une base pas encore essayée ; l'autre plat verrouillé
// → une autre recette de sa base. Sinon, ou faute de mieux, la meilleure recette qui convient à
// tous les mangeurs de la carte.
export function nextIdea<C extends PlannerCard>(input: {
  card: C;
  cards: readonly C[];
  members: readonly PlannerMember[];
  recipes: readonly PlannerRecipe[];
  tried: readonly string[];
  seed: number;
}): Idea<C> | null {
  const { card } = input;
  const week: Week = {
    cards: [...input.cards],
    recipes: new Map(input.recipes.map((recipe) => [recipe.id, recipe])),
    seed: input.seed,
  };
  const eatersOf = (target: PlannerCard) => input.members.filter((member) => target.member_ids.includes(member.id));
  const eaters = eatersOf(card);
  const excluded = new Set([card.recipe_id, ...input.tried]);
  const base = baseKey(week.recipes.get(card.recipe_id)?.base);
  const partner = base
    ? input.cards.find(
        (other) =>
          other.day === card.day &&
          other.meal_type === card.meal_type &&
          baseKey(week.recipes.get(other.recipe_id)?.base) === base,
      )
    : undefined;
  const pool = input.recipes.filter(
    (recipe) =>
      recipe.meal_types.includes(card.meal_type) &&
      !excluded.has(recipe.id) &&
      isAvailable(recipe, card.day, card.meal_type, week.cards),
  );

  if (partner?.locked) {
    const same = onePerGroup(
      [eaters],
      pool.filter((recipe) => baseKey(recipe.base) === base),
      card.day,
      card.meal_type,
      week,
    );
    if (same) return { recipe_id: same[0].recipe.id };
  } else if (partner) {
    const triedBases = new Set([base, ...input.tried.map((id) => baseKey(week.recipes.get(id)?.base))]);
    const groups = [eaters, eatersOf(partner)];
    const best = baseOptions(pool)
      .filter((other) => !triedBases.has(other))
      .map((other) =>
        onePerGroup(
          groups,
          pool.filter((recipe) => baseKey(recipe.base) === other && recipe.id !== partner.recipe_id),
          card.day,
          card.meal_type,
          week,
        ),
      )
      .filter((dishes): dishes is Dish[] => dishes !== null)
      .map((dishes) => ({ dishes, score: solutionScore(dishes, [], card.day, card.meal_type, week) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best) {
      return {
        recipe_id: best.dishes[0].recipe.id,
        partner: { card: partner, recipe_id: best.dishes[1].recipe.id },
      };
    }
  }

  const candidates = input.recipes.filter(
    (recipe) =>
      !recipe.basic &&
      recipe.meal_types.includes(card.meal_type) &&
      !excluded.has(recipe.id) &&
      eaters.every((member) => canEat(recipe, member)),
  );
  const choice = choose(eaters, card.day, card.meal_type, candidates, week);
  return choice ? { recipe_id: choice.recipe.id } : null;
}
