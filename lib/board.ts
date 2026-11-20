import { MEAL_TYPES, type MealType, type SlotInput } from "@/lib/meal-slots";
import { canEat, type PlannerMember, type PlannerRecipe } from "@/lib/planner";
import { EXTRA_COURSES, isExtra, type Course } from "@/lib/recipes";

// La grille de la semaine : une ligne par moment de la journée, une case par jour, et dans
// chaque case les créneaux configurés avec leurs cartes. Code pur, testé par lib/board.test.ts.
// Une carte est un plat, ou un plat léger (entrée, dessert, fruit, fromage, laitage) : chaque
// présent mange un seul plat par repas, mais autant de plats légers qu'il veut.

export type BoardRowKey = "petit_dej" | "midi" | "soir";

// Le pique-nique se mange à midi : il partage la ligne du midi.
const ROWS: { row: BoardRowKey; label: string; meals: MealType[] }[] = [
  { row: "petit_dej", label: "Petit-déj", meals: ["petit_dej"] },
  { row: "midi", label: "Midi", meals: ["midi", "pique_nique"] },
  { row: "soir", label: "Dîner", meals: ["soir"] },
];

type BoardCard = { day: number; meal_type: MealType; position: number; member_ids: string[]; course?: Course };

export type BoardSlot<C> = {
  day: number;
  meal_type: MealType;
  member_ids: string[];
  // Les plats.
  cards: C[];
  // Au-dessus des plats.
  starters: C[];
  // Sous les plats : laitages, fruits, fromages, desserts.
  extras: C[];
  // Présents sans plat (un créneau sans aucun plat n'en compte pas : il est à remplir). Un plat
  // léger ne nourrit personne : un repas qui n'a qu'un yaourt reste à remplir.
  unfed: string[];
};

export type BoardRow<C> = {
  row: BoardRowKey;
  label: string;
  days: { day: number; slots: BoardSlot<C>[] }[];
};

const MEAL_ORDER = MEAL_TYPES.map((meal) => meal.value);

export function buildBoard<C extends BoardCard>(slots: readonly SlotInput[], cards: readonly C[]): BoardRow<C>[] {
  return ROWS.filter(({ meals }) => slots.some((slot) => meals.includes(slot.meal_type))).map(({ row, label, meals }) => ({
    row,
    label,
    days: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      slots: slots
        .filter((slot) => slot.day === day && meals.includes(slot.meal_type))
        .sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type))
        .map((slot) => {
          const here = cards
            .filter((card) => card.day === day && card.meal_type === slot.meal_type)
            .sort((a, b) => a.position - b.position);
          const dishes = here.filter((card) => !isExtra(card.course));
          const fed = new Set(dishes.flatMap((card) => card.member_ids));
          return {
            day,
            meal_type: slot.meal_type,
            member_ids: [...slot.member_ids],
            cards: dishes,
            starters: here.filter((card) => card.course === "starter"),
            extras: here
              .filter((card) => card.course && EXTRA_COURSES.includes(card.course))
              .sort((a, b) => EXTRA_COURSES.indexOf(a.course!) - EXTRA_COURSES.indexOf(b.course!)),
            unfed: dishes.length === 0 ? [] : slot.member_ids.filter((id) => !fed.has(id)),
          };
        }),
    })),
  }));
}

// L'élément principal déjà au menu d'un repas, pour mettre ses basiques en tête : celui des
// autres plats du créneau (dans leur ordre), sinon celui du plat qu'on change (`cardId`). Les
// plats légers ne comptent pas.
export function menuBase<
  C extends { id: string; day: number; meal_type: MealType; position: number; recipe_id: string; course?: Course },
>(
  cards: readonly C[],
  baseOf: (recipeId: string) => string | null | undefined,
  target: { day: number; meal_type: MealType; cardId?: string },
): string | null {
  const here = cards
    .filter((card) => card.day === target.day && card.meal_type === target.meal_type && !isExtra(card.course))
    .sort((a, b) => Number(a.id === target.cardId) - Number(b.id === target.cardId) || a.position - b.position);
  return here.map((card) => baseOf(card.recipe_id)).find((base) => base?.trim()) ?? null;
}

// Chaque présent mange un seul plat par repas : `eaterIds` passent sur le plat `cardId` (qui se
// verrouille, choix fait à la main) et quittent les autres plats du même repas ; un plat qui
// n'a plus personne disparaît. Sur un plat léger, ses mangeurs changent, rien d'autre. Même
// règle que set_planned_meal_eaters, pour l'écran.
export function moveEaters<
  C extends { id: string; day: number; meal_type: MealType; member_ids: string[]; locked: boolean; course?: Course },
>(cards: readonly C[], cardId: string, eaterIds: readonly string[]): C[] {
  const target = cards.find((card) => card.id === cardId);
  if (!target) return [...cards];
  if (isExtra(target.course)) {
    return cards.map((card) => (card.id === cardId ? { ...card, member_ids: [...eaterIds] } : card));
  }
  return cards.flatMap((card) => {
    if (card.id === cardId) return [{ ...card, member_ids: [...eaterIds], locked: true }];
    if (card.day !== target.day || card.meal_type !== target.meal_type || isExtra(card.course)) return [card];
    const rest = card.member_ids.filter((id) => !eaterIds.includes(id));
    return rest.length > 0 ? [{ ...card, member_ids: rest }] : [];
  });
}

// ─── Ajouter des plats légers ───────────────────────────────────────────────

// Un repas, ou tous les repas de ce type dans la semaine à partir du jour `fromDay` (aujourd'hui
// dans la semaine en cours, lundi sinon). « Tous les midis » ne vise pas le pique-nique.
export type ExtraTarget = { day: number; meal_type: MealType } | { meal_type: MealType; fromDay: number };

// Ce qu'on envoie à add_planned_extras : une recette pour certains mangeurs ; `cardId` quand elle
// est déjà au repas (ses mangeurs fusionnent).
export type ExtraItem = { day: number; meal_type: MealType; recipe_id: string; member_ids: string[]; cardId?: string };
export type Unserved = { day: number; meal_type: MealType; member_ids: string[] };

// Pour chaque repas visé et chaque recette : les choisis présents au repas qui peuvent la manger
// (régimes et exclusions : on ne sert jamais d'office à quelqu'un ce qui ne lui va pas) ; rien si
// personne ; fusion si la recette y est déjà (rien si elle a déjà tout ce monde). `unserved` : par
// repas, les choisis présents qui n'ont rien pu avoir (« Et pour Marie-Laure ? »).
export function extrasToAdd({
  recipes,
  eaterIds,
  target,
  slots,
  cards,
  members,
}: {
  recipes: readonly (Pick<PlannerRecipe, "diets" | "excludedIds"> & { id: string })[];
  eaterIds: readonly string[];
  target: ExtraTarget;
  slots: readonly SlotInput[];
  cards: readonly { id: string; day: number; meal_type: MealType; recipe_id: string; member_ids: readonly string[] }[];
  members: readonly PlannerMember[];
}): { items: ExtraItem[]; unserved: Unserved[] } {
  const items: ExtraItem[] = [];
  const unserved: Unserved[] = [];
  const targeted = slots
    .filter(
      (slot) =>
        slot.meal_type === target.meal_type && ("day" in target ? slot.day === target.day : slot.day >= target.fromDay),
    )
    .sort((a, b) => a.day - b.day);

  for (const slot of targeted) {
    const chosen = slot.member_ids.filter((id) => eaterIds.includes(id));
    const served = new Set<string>();
    for (const recipe of recipes) {
      const eaters = chosen.filter((id) => {
        const member = members.find((candidate) => candidate.id === id);
        return member !== undefined && canEat(recipe, member);
      });
      if (eaters.length === 0) continue;
      for (const id of eaters) served.add(id);
      const meal = { day: slot.day, meal_type: slot.meal_type, recipe_id: recipe.id };
      const existing = cards.find(
        (card) => card.day === slot.day && card.meal_type === slot.meal_type && card.recipe_id === recipe.id,
      );
      if (!existing) {
        items.push({ ...meal, member_ids: eaters });
        continue;
      }
      const added = eaters.filter((id) => !existing.member_ids.includes(id));
      if (added.length > 0) items.push({ ...meal, member_ids: [...existing.member_ids, ...added], cardId: existing.id });
    }
    const left = chosen.filter((id) => !served.has(id));
    if (left.length > 0) unserved.push({ day: slot.day, meal_type: slot.meal_type, member_ids: left });
  }
  return { items, unserved };
}
