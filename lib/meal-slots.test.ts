import { describe, expect, it } from "vitest";
import { LEA, PAUL, TOM } from "@/test/helpers";
import {
  describeAttendees,
  describeDays,
  initialSelection,
  slotsFromSelection,
  summarizeMeals,
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
