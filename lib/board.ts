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
