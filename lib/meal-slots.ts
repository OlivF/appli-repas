import type { Database } from "@/lib/supabase/database.types";

export type MealType = Database["public"]["Enums"]["meal_type"];

// Index = numéro du jour en base : 0 = lundi … 6 = dimanche.
export const DAYS = [
  { short: "Lun", long: "lundi" },
  { short: "Mar", long: "mardi" },
  { short: "Mer", long: "mercredi" },
  { short: "Jeu", long: "jeudi" },
  { short: "Ven", long: "vendredi" },
  { short: "Sam", long: "samedi" },
  { short: "Dim", long: "dimanche" },
] as const;

// Dans l'ordre de la journée.
export const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: "petit_dej", label: "Petit-déj", emoji: "☕" },
  { value: "midi", label: "Midi", emoji: "🥗" },
  { value: "pique_nique", label: "Pique-nique", emoji: "🧺" },
  { value: "soir", label: "Dîner", emoji: "🍲" },
];

// Cochés d'office pour tout le monde.
const DEFAULT_MEALS: MealType[] = ["petit_dej", "soir"];

export type SlotInput = { day: number; meal_type: MealType; member_ids: string[] };

// Valeur d'une case de la grille : « jour:repas:membre ».
export function cellKey(day: number, mealType: MealType, memberId: string) {
  return `${day}:${mealType}:${memberId}`;
}

// Cases à cocher au départ : les créneaux enregistrés, et petit-déj + dîner
// tous les jours pour qui n'a encore aucun créneau (tout le monde, la première fois).
export function initialSelection(slots: SlotInput[], memberIds: string[]): string[] {
  const selection: string[] = [];
  const seated = new Set<string>();

  for (const slot of slots) {
    for (const memberId of slot.member_ids) {
      if (!memberIds.includes(memberId)) continue;
      selection.push(cellKey(slot.day, slot.meal_type, memberId));
      seated.add(memberId);
    }
  }

  for (const memberId of memberIds) {
    if (seated.has(memberId)) continue;
    DAYS.forEach((_, day) => {
      for (const meal of DEFAULT_MEALS) selection.push(cellKey(day, meal, memberId));
    });
  }

  return selection;
}

// Transforme les cases cochées en créneaux (les cases invalides sont ignorées).
export function slotsFromSelection(values: string[], memberIds: string[]): SlotInput[] {
  const checked = new Set(values);
  const slots: SlotInput[] = [];

  DAYS.forEach((_, day) => {
    for (const { value: mealType } of MEAL_TYPES) {
      const presentIds = memberIds.filter((id) => checked.has(cellKey(day, mealType, id)));
      if (presentIds.length > 0) slots.push({ day, meal_type: mealType, member_ids: presentIds });
    }
  });

  return slots;
}

// « Tout le monde », « Léa », « Paul et Tom », « Paul, Léa et Tom ».
export function describeAttendees(
  memberIds: string[],
  members: { id: string; first_name: string }[],
): string {
  const present = members.filter((member) => memberIds.includes(member.id));
  if (members.length > 1 && present.length === members.length) return "Tout le monde";
  return new Intl.ListFormat("fr", { type: "conjunction" }).format(
    present.map((member) => member.first_name),
  );
}

// « tous les jours », « en semaine », « le week-end », « lundi, mardi et jeudi ».
export function describeDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const key = sorted.join(",");
  if (key === "0,1,2,3,4,5,6") return "tous les jours";
  if (key === "0,1,2,3,4") return "en semaine";
  if (key === "5,6") return "le week-end";
  return new Intl.ListFormat("fr", { type: "conjunction" }).format(
    sorted.map((day) => DAYS[day].long),
  );
}

export type MealSummary = { label: string; lines: { who: string; when: string }[] };

// Résumé lisible de la semaine : pour chaque repas, qui mange et quels jours.
export function summarizeMeals(
  slots: SlotInput[],
  members: { id: string; first_name: string }[],
): MealSummary[] {
  const memberOrder = members.map((member) => member.id);

  return MEAL_TYPES.flatMap(({ value, label }) => {
    const groups = new Map<string, { memberIds: string[]; days: number[] }>();
    const mealSlots = slots
      .filter((slot) => slot.meal_type === value)
      .sort((a, b) => a.day - b.day);

    for (const slot of mealSlots) {
      const memberIds = memberOrder.filter((id) => slot.member_ids.includes(id));
      if (memberIds.length === 0) continue;
      const key = memberIds.join(",");
      const group = groups.get(key) ?? { memberIds, days: [] };
      group.days.push(slot.day);
      groups.set(key, group);
    }

    if (groups.size === 0) return [];
    return [
      {
        label,
        lines: [...groups.values()].map((group) => ({
          who: describeAttendees(group.memberIds, members),
          when: describeDays(group.days),
        })),
      },
    ];
  });
}
