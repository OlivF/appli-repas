import { describe, expect, it } from "vitest";
import { LEA, PAUL, TOM } from "@/test/helpers";
import {
  describeAttendees,
  describeChange,
  describeDays,
  initialSelection,
  slotsFromSelection,
  summarizeMeals,
  weekChanges,
  weekMealMessage,
  weekSlots,
  type SlotInput,
} from "./meal-slots";

describe("initialSelection", () => {
  it("coche petit-déj et dîner pour tout le monde quand rien n'est enregistré", () => {
    const selection = initialSelection([], [PAUL, LEA]);

    expect(selection).toHaveLength(28); // 7 jours × 2 repas × 2 personnes
    expect(selection).toContain(`0:petit_dej:${PAUL}`);
    expect(selection).toContain(`6:soir:${LEA}`);
    expect(selection).not.toContain(`0:midi:${PAUL}`);
    expect(selection).not.toContain(`2:pique_nique:${LEA}`);
  });

  it("reprend exactement les créneaux enregistrés", () => {
    const selection = initialSelection(
      [
        { day: 0, meal_type: "midi", member_ids: [LEA] },
        { day: 2, meal_type: "soir", member_ids: [PAUL, LEA] },
      ],
      [PAUL, LEA],
    );

    expect([...selection].sort()).toEqual([`0:midi:${LEA}`, `2:soir:${LEA}`, `2:soir:${PAUL}`].sort());
  });

  it("préremplit petit-déj et dîner pour un membre ajouté après coup", () => {
    const selection = initialSelection([{ day: 0, meal_type: "midi", member_ids: [PAUL] }], [PAUL, TOM]);

    expect(selection).toContain(`0:midi:${PAUL}`);
    expect(selection).not.toContain(`0:soir:${PAUL}`);
    expect(selection).toContain(`3:petit_dej:${TOM}`);
    expect(selection).toContain(`3:soir:${TOM}`);
    expect(selection).not.toContain(`0:midi:${TOM}`);
  });
});

describe("slotsFromSelection", () => {
  it("regroupe les cases cochées en créneaux, dans l'ordre de la semaine et du foyer", () => {
    const slots = slotsFromSelection(
      [`2:pique_nique:${LEA}`, `0:midi:${LEA}`, `0:midi:${PAUL}`, `0:petit_dej:${PAUL}`],
      [PAUL, LEA],
    );

    expect(slots).toEqual([
      { day: 0, meal_type: "petit_dej", member_ids: [PAUL] },
      { day: 0, meal_type: "midi", member_ids: [PAUL, LEA] },
      { day: 2, meal_type: "pique_nique", member_ids: [LEA] },
    ]);
  });

  it("ignore les cases invalides, inconnues ou en double", () => {
    const slots = slotsFromSelection(
      [
        `7:midi:${PAUL}`,
        `0:brunch:${PAUL}`,
        "0:midi:intrus",
        "n'importe quoi",
        `1:soir:${PAUL}`,
        `1:soir:${PAUL}`,
      ],
      [PAUL],
    );

    expect(slots).toEqual([{ day: 1, meal_type: "soir", member_ids: [PAUL] }]);
  });
});

describe("describeAttendees", () => {
  const members = [
    { id: PAUL, first_name: "Paul" },
    { id: LEA, first_name: "Léa" },
    { id: TOM, first_name: "Tom" },
  ];

  it.each([
    [[PAUL, LEA, TOM], "Tout le monde"],
    [[LEA], "Léa"],
    [[TOM, PAUL], "Paul et Tom"],
  ])("décrit %j comme « %s »", (memberIds, expected) => {
    expect(describeAttendees(memberIds, members)).toBe(expected);
  });

  it("donne le prénom quand le foyer compte une seule personne", () => {
    expect(describeAttendees([PAUL], [{ id: PAUL, first_name: "Paul" }])).toBe("Paul");
  });

  it("liste trois personnes sur quatre à la française", () => {
    const four = [...members, { id: "44444444-4444-4444-8444-444444444444", first_name: "Zoé" }];
    expect(describeAttendees([PAUL, LEA, TOM], four)).toBe("Paul, Léa et Tom");
  });
});

describe("describeDays", () => {
  it.each([
    [[0, 1, 2, 3, 4, 5, 6], "tous les jours"],
    [[0, 1, 2, 3, 4], "en semaine"],
    [[5, 6], "le week-end"],
    [[2], "mercredi"],
    [[0, 1, 3, 4], "lundi, mardi, jeudi et vendredi"],
  ])("décrit %j comme « %s »", (days, expected) => {
    expect(describeDays(days)).toBe(expected);
  });
});

describe("summarizeMeals", () => {
  const members = [
    { id: PAUL, first_name: "Paul" },
    { id: LEA, first_name: "Léa" },
  ];
  const everyDay = (meal_type: "petit_dej" | "soir") =>
    [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, meal_type, member_ids: [PAUL, LEA] }));

  it("résume la semaine repas par repas, en regroupant les jours identiques", () => {
    const summary = summarizeMeals(
      [
        ...everyDay("soir"),
        { day: 2, meal_type: "pique_nique", member_ids: [LEA] },
        { day: 0, meal_type: "midi", member_ids: [PAUL] },
        { day: 1, meal_type: "midi", member_ids: [PAUL] },
        { day: 3, meal_type: "midi", member_ids: [PAUL, LEA] },
        ...everyDay("petit_dej"),
      ],
      members,
    );

    expect(summary).toEqual([
      { label: "Petit-déj", lines: [{ who: "Tout le monde", when: "tous les jours" }] },
      {
        label: "Midi",
        lines: [
          { who: "Paul", when: "lundi et mardi" },
          { who: "Tout le monde", when: "jeudi" },
        ],
      },
      { label: "Pique-nique", lines: [{ who: "Léa", when: "mercredi" }] },
      { label: "Dîner", lines: [{ who: "Tout le monde", when: "tous les jours" }] },
    ]);
  });

  it("ne garde que les repas qui ont au moins un créneau", () => {
    expect(summarizeMeals(everyDay("soir"), members).map((meal) => meal.label)).toEqual(["Dîner"]);
  });
});

// ─── Les repas d'une semaine : le foyer de test ─────────────────────────────
const OLIVIER = "o";
const ML = "ml";
const TIMOTHE = "t";
const ANNA = "a";
const OTIS = "x";
const ALL = [OLIVIER, ML, TIMOTHE, ANNA, OTIS];
const FAMILY = [
  { id: OLIVIER, first_name: "Olivier" },
  { id: ML, first_name: "Marie-Laure" },
  { id: TIMOTHE, first_name: "Timothé" },
  { id: ANNA, first_name: "Anna-Lucia" },
  { id: OTIS, first_name: "Otis" },
];
// Petit-déj et dîner pour tous ; midi Marie-Laure lun/mar/jeu/ven ; mercredi pique-nique Otis + Anna-Lucia.
const HOME: SlotInput[] = [
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
    { day, meal_type: "petit_dej" as const, member_ids: ALL },
    { day, meal_type: "soir" as const, member_ids: ALL },
  ]),
  ...[0, 1, 3, 4].map((day) => ({ day, meal_type: "midi" as const, member_ids: [ML] })),
  { day: 2, meal_type: "pique_nique", member_ids: [ANNA, OTIS] },
];
const WITHOUT_ML = { day: 0, meal_type: "soir" as const, member_ids: [OLIVIER, TIMOTHE, ANNA, OTIS] };
const SATURDAY_LUNCH = { day: 5, meal_type: "midi" as const, member_ids: ALL };
const NO_SUNDAY_DINNER = { day: 6, meal_type: "soir" as const, member_ids: [] };
const find = (slots: SlotInput[], day: number, meal: SlotInput["meal_type"]) =>
  slots.find((slot) => slot.day === day && slot.meal_type === meal);

describe("weekSlots", () => {
  it("sans exception : les repas du foyer", () => {
    expect(weekSlots(HOME, [])).toHaveLength(HOME.length);
  });

  it("lundi soir sans Marie-Laure", () => {
    expect(find(weekSlots(HOME, [WITHOUT_ML]), 0, "soir")?.member_ids).toEqual([OLIVIER, TIMOTHE, ANNA, OTIS]);
  });

  it("samedi midi ajouté pour tous, dimanche soir retiré", () => {
    const slots = weekSlots(HOME, [SATURDAY_LUNCH, NO_SUNDAY_DINNER]);
    expect(find(slots, 5, "midi")?.member_ids).toEqual(ALL);
    expect(find(slots, 6, "soir")).toBeUndefined();
    expect(slots).toHaveLength(HOME.length);
  });

  it("triés par jour, puis dans l'ordre de la journée", () => {
    const slots = weekSlots(HOME, [SATURDAY_LUNCH]);
    const saturday = slots.filter((slot) => slot.day === 5).map((slot) => slot.meal_type);
    expect(saturday).toEqual(["petit_dej", "midi", "soir"]);
    expect(slots.map((slot) => slot.day)).toEqual([...slots.map((slot) => slot.day)].sort((a, b) => a - b));
  });
});

describe("weekChanges", () => {
  it("les trois sortes de changement, avec les présents du foyer", () => {
    expect(weekChanges(HOME, [WITHOUT_ML, SATURDAY_LUNCH, NO_SUNDAY_DINNER])).toEqual([
      { day: 0, meal_type: "soir", kind: "changed", member_ids: [OLIVIER, TIMOTHE, ANNA, OTIS], home_ids: ALL },
      { day: 5, meal_type: "midi", kind: "added", member_ids: ALL, home_ids: [] },
      { day: 6, meal_type: "soir", kind: "removed", member_ids: [], home_ids: ALL },
    ]);
  });

  it("une exception identique au foyer (dans un autre ordre) ne compte pas", () => {
    expect(weekChanges(HOME, [{ day: 1, meal_type: "soir", member_ids: [...ALL].reverse() }])).toEqual([]);
  });

  it("un repas vide là où le foyer n'en a pas ne compte pas", () => {
    expect(weekChanges(HOME, [{ day: 5, meal_type: "pique_nique", member_ids: [] }])).toEqual([]);
  });
});

describe("weekMealMessage", () => {
  const message = (day: number, meal_type: SlotInput["meal_type"], before: string[], after: string[], home: string[]) =>
    weekMealMessage({ day, meal_type, before, after, home, members: FAMILY });

  it("pas de repas", () => {
    expect(message(6, "soir", ALL, [], ALL)).toBe("Pas de dîner dimanche cette semaine");
  });

  it("revenu au réglage du foyer", () => {
    expect(message(0, "soir", [OLIVIER], ALL, ALL)).toBe("Dîner de lundi : comme d’habitude");
  });

  it("un repas ajouté", () => {
    expect(message(5, "midi", [], ALL, [])).toBe("Midi de samedi ajouté");
  });

  it("quelqu'un en moins", () => {
    expect(message(0, "soir", ALL, [OLIVIER, TIMOTHE, ANNA, OTIS], ALL)).toBe("Dîner de lundi : sans Marie-Laure cette semaine");
  });

  it("quelqu'un en plus", () => {
    expect(message(0, "midi", [ML], [ML, TIMOTHE], [ML])).toBe("Midi de lundi : avec Timothé cette semaine");
  });

  it("en moins et en plus", () => {
    expect(message(0, "midi", [ML], [TIMOTHE], [ML])).toBe("Midi de lundi : changé pour cette semaine");
  });
});

describe("describeChange", () => {
  const [changed, added, removed] = weekChanges(HOME, [WITHOUT_ML, SATURDAY_LUNCH, NO_SUNDAY_DINNER]);

  it("une ligne par repas changé", () => {
    expect(describeChange(changed, FAMILY)).toBe("Dîner de lundi : sans Marie-Laure");
    expect(describeChange(added, FAMILY)).toBe("Midi de samedi : ajouté");
    expect(describeChange(removed, FAMILY)).toBe("Pas de dîner dimanche");
  });

  it("avec, et sans et avec", () => {
    const [plus] = weekChanges(HOME, [{ day: 0, meal_type: "midi", member_ids: [ML, OTIS] }]);
    expect(describeChange(plus, FAMILY)).toBe("Midi de lundi : avec Otis");
    const [both] = weekChanges(HOME, [{ day: 0, meal_type: "midi", member_ids: [OTIS] }]);
    expect(describeChange(both, FAMILY)).toBe("Midi de lundi : sans Marie-Laure, avec Otis");
  });
});
