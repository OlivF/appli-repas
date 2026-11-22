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

// ─── Les repas d'une semaine ────────────────────────────────────────────────
// Le réglage du foyer est le modèle de toutes les semaines ; une semaine peut changer un repas
// (week_meal_overrides) : ses présents remplacent ceux du foyer, vide = pas de repas.

export type WeekOverride = { day: number; meal_type: MealType; member_ids: string[] };
export type WeekChange = {
  day: number;
  meal_type: MealType;
  kind: "added" | "removed" | "changed";
  // Les présents cette semaine, et ceux du foyer (pour « Comme d'habitude »).
  member_ids: string[];
  home_ids: string[];
};

const MEAL_ORDER = MEAL_TYPES.map((meal) => meal.value);
const sameSet = (first: readonly string[], second: readonly string[]) =>
  first.length === new Set(second).size && first.every((id) => second.includes(id)) && second.every((id) => first.includes(id));
const byDayAndMeal = (a: { day: number; meal_type: MealType }, b: { day: number; meal_type: MealType }) =>
  a.day - b.day || MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type);

// Les repas qui ont lieu cette semaine : ceux du foyer, remplacés par les exceptions, sans les
// repas vides, triés par jour puis dans l'ordre de la journée.
export function weekSlots(slots: readonly SlotInput[], overrides: readonly WeekOverride[]): SlotInput[] {
  const changed = (slot: { day: number; meal_type: MealType }) =>
    overrides.find((override) => override.day === slot.day && override.meal_type === slot.meal_type);
  return [
    ...slots.filter((slot) => !changed(slot)).map((slot) => ({ ...slot, member_ids: [...slot.member_ids] })),
    ...overrides.map((override) => ({ day: override.day, meal_type: override.meal_type, member_ids: [...override.member_ids] })),
  ]
    .filter((slot) => slot.member_ids.length > 0)
    .sort(byDayAndMeal);
}

// Les repas qui ne suivent pas le foyer cette semaine : ajouté, retiré ou changé (qui est là). Une
// exception identique au foyer ne compte pas.
export function weekChanges(slots: readonly SlotInput[], overrides: readonly WeekOverride[]): WeekChange[] {
  return overrides
    .flatMap((override): WeekChange[] => {
      const home = slots.find((slot) => slot.day === override.day && slot.meal_type === override.meal_type)?.member_ids ?? [];
      if (sameSet(home, override.member_ids)) return [];
      const kind = home.length === 0 ? "added" : override.member_ids.length === 0 ? "removed" : "changed";
      return [{ day: override.day, meal_type: override.meal_type, kind, member_ids: [...override.member_ids], home_ids: [...home] }];
    })
    .sort(byDayAndMeal);
}

type Named = { id: string; first_name: string };
const names = (ids: readonly string[], members: readonly Named[]) =>
  new Intl.ListFormat("fr", { type: "conjunction" }).format(
    members.filter((member) => ids.includes(member.id)).map((member) => member.first_name),
  );
const mealLabel = (mealType: MealType) => MEAL_TYPES.find((meal) => meal.value === mealType)!.label;
// « Dîner de lundi », « Pas de dîner dimanche ».
const mealOfDay = (day: number, mealType: MealType) => `${mealLabel(mealType)} de ${DAYS[day].long}`;
const noMeal = (day: number, mealType: MealType) => `Pas de ${mealLabel(mealType).toLowerCase()} ${DAYS[day].long}`;

// Le toast après « Qui est là ? » : `before` et `after`, les présents avant et après ; `home`,
// ceux du foyer.
export function weekMealMessage({
  day,
  meal_type,
  before,
  after,
  home,
  members,
}: {
  day: number;
  meal_type: MealType;
  before: readonly string[];
  after: readonly string[];
  home: readonly string[];
  members: readonly Named[];
}): string {
  if (after.length === 0) return `${noMeal(day, meal_type)} cette semaine`;
  if (home.length > 0 && sameSet(home, after)) return `${mealOfDay(day, meal_type)} : comme d’habitude`;
  if (before.length === 0) return `${mealOfDay(day, meal_type)} ajouté`;
  const gone = before.filter((id) => !after.includes(id));
  const come = after.filter((id) => !before.includes(id));
  if (gone.length > 0 && come.length === 0) return `${mealOfDay(day, meal_type)} : sans ${names(gone, members)} cette semaine`;
  if (come.length > 0 && gone.length === 0) return `${mealOfDay(day, meal_type)} : avec ${names(come, members)} cette semaine`;
  return `${mealOfDay(day, meal_type)} : changé pour cette semaine`;
}

// Une ligne de « Tout remettre comme d'habitude ? » : ce qui change par rapport au foyer.
export function describeChange(change: WeekChange, members: readonly Named[]): string {
  if (change.kind === "removed") return noMeal(change.day, change.meal_type);
  if (change.kind === "added") return `${mealOfDay(change.day, change.meal_type)} : ajouté`;
  const gone = change.home_ids.filter((id) => !change.member_ids.includes(id));
  const come = change.member_ids.filter((id) => !change.home_ids.includes(id));
  const parts = [gone.length > 0 && `sans ${names(gone, members)}`, come.length > 0 && `avec ${names(come, members)}`];
  return `${mealOfDay(change.day, change.meal_type)} : ${parts.filter(Boolean).join(", ")}`;
}
