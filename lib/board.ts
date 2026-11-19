import { MEAL_TYPES, type MealType, type SlotInput } from "@/lib/meal-slots";

// La grille de la semaine : une ligne par moment de la journée, une case par jour, et dans
// chaque case les créneaux configurés avec leurs cartes. Code pur, testé par lib/board.test.ts.

export type BoardRowKey = "petit_dej" | "midi" | "soir";

// Le pique-nique se mange à midi : il partage la ligne du midi.
const ROWS: { row: BoardRowKey; label: string; meals: MealType[] }[] = [
  { row: "petit_dej", label: "Petit-déj", meals: ["petit_dej"] },
  { row: "midi", label: "Midi", meals: ["midi", "pique_nique"] },
  { row: "soir", label: "Dîner", meals: ["soir"] },
];

type BoardCard = { day: number; meal_type: MealType; position: number; member_ids: string[] };

export type BoardSlot<C> = {
  day: number;
  meal_type: MealType;
  member_ids: string[];
  cards: C[];
  // Présents sans plat (un créneau sans aucune carte n'en compte pas : il est à remplir).
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
          const fed = new Set(here.flatMap((card) => card.member_ids));
          return {
            day,
            meal_type: slot.meal_type,
            member_ids: [...slot.member_ids],
            cards: here,
            unfed: here.length === 0 ? [] : slot.member_ids.filter((id) => !fed.has(id)),
          };
        }),
    })),
  }));
}

// L'élément principal déjà au menu d'un repas, pour mettre ses basiques en tête : celui des
// autres plats du créneau (dans leur ordre), sinon celui du plat qu'on change (`cardId`).
export function menuBase<C extends { id: string; day: number; meal_type: MealType; position: number; recipe_id: string }>(
  cards: readonly C[],
  baseOf: (recipeId: string) => string | null | undefined,
  target: { day: number; meal_type: MealType; cardId?: string },
): string | null {
  const here = cards
    .filter((card) => card.day === target.day && card.meal_type === target.meal_type)
    .sort((a, b) => Number(a.id === target.cardId) - Number(b.id === target.cardId) || a.position - b.position);
  return here.map((card) => baseOf(card.recipe_id)).find((base) => base?.trim()) ?? null;
}

// Chaque présent mange un seul plat par repas : `eaterIds` passent sur le plat `cardId` (qui se
// verrouille, choix fait à la main) et quittent les autres plats du même repas ; un plat qui
// n'a plus personne disparaît. Même règle que set_planned_meal_eaters, pour l'écran.
export function moveEaters<C extends { id: string; day: number; meal_type: MealType; member_ids: string[]; locked: boolean }>(
  cards: readonly C[],
  cardId: string,
  eaterIds: readonly string[],
): C[] {
  const target = cards.find((card) => card.id === cardId);
  if (!target) return [...cards];
  return cards.flatMap((card) => {
    if (card.id === cardId) return [{ ...card, member_ids: [...eaterIds], locked: true }];
    if (card.day !== target.day || card.meal_type !== target.meal_type) return [card];
    const rest = card.member_ids.filter((id) => !eaterIds.includes(id));
    return rest.length > 0 ? [{ ...card, member_ids: rest }] : [];
  });
}
