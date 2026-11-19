import { describe, expect, it } from "vitest";
import basicsFile from "@/recettes-basiques.json";
import { baseKey } from "@/lib/bases";
import type { MealType } from "@/lib/meal-slots";
import type { Diet } from "@/lib/members";
import {
  canEat,
  mainProtein,
  nextIdea,
  proposeWeek,
  type PlannerCard,
  type PlannerMember,
  type PlannerRecipe,
  type PlannerSlot,
} from "@/lib/planner";
import type { GroceryAisle } from "@/lib/recipes";
import { LEA, PAUL, TOM } from "@/test/helpers";

const ZOE = "44444444-4444-4444-8444-444444444444";

const MEMBERS: PlannerMember[] = [
  { id: PAUL, diets: [] },
  { id: LEA, diets: ["keto"] },
  { id: TOM, diets: [] },
  { id: ZOE, diets: ["vegetarian"] },
];

function recipe(id: string, overrides: Partial<PlannerRecipe> = {}): PlannerRecipe {
  return {
    id,
    meal_types: ["soir"],
    diets: [],
    excludedIds: [],
    favorite: false,
    minutes: 30,
    protein: null,
    base: null,
    ...overrides,
  };
}

function slot(day: number, meal_type: MealType, member_ids: string[]): PlannerSlot {
  return { day, meal_type, member_ids };
}

function propose(slots: PlannerSlot[], recipes: PlannerRecipe[], options: { locked?: PlannerCard[]; seed?: number } = {}) {
  return proposeWeek({ slots, members: MEMBERS, recipes, locked: options.locked ?? [], seed: options.seed ?? 1 });
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("canEat", () => {
  it("respecte les régimes et les exclusions", () => {
    expect(canEat(recipe("a"), MEMBERS[0])).toBe(true);
    expect(canEat(recipe("a"), MEMBERS[1])).toBe(false);
    expect(canEat(recipe("k", { diets: ["keto"] }), MEMBERS[1])).toBe(true);
    expect(canEat(recipe("k", { diets: ["keto"], excludedIds: [LEA] }), MEMBERS[1])).toBe(false);
  });
});

describe("proposeWeek : qui mange quoi", () => {
  it("un seul plat pour des présents qui ont les mêmes régimes", () => {
    const { cards } = propose([slot(0, "soir", [PAUL, TOM])], [recipe("a"), recipe("b")]);
    expect(cards).toHaveLength(1);
    expect(cards[0].member_ids).toEqual([PAUL, TOM]);
  });

  it("un plat par régime plutôt qu'un plat céto pour tous", () => {
    const { cards } = propose([slot(0, "soir", [PAUL, LEA])], [recipe("a"), recipe("k", { diets: ["keto"] })]);
    expect(cards).toEqual([
      { day: 0, meal_type: "soir", position: 0, recipe_id: "a", member_ids: [PAUL], locked: false },
      { day: 0, meal_type: "soir", position: 1, recipe_id: "k", member_ids: [LEA], locked: false },
    ]);
  });

  it("un seul plat céto pour tous quand il n'y a rien d'autre", () => {
    const { cards } = propose(
      [slot(0, "soir", [PAUL, LEA])],
      [recipe("k1", { diets: ["keto"] }), recipe("k2", { diets: ["keto"] })],
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].member_ids).toEqual([PAUL, LEA]);
  });

  it("sinon la recette qui couvre le plus, puis une carte pour les autres", () => {
    const { cards } = propose(
      [slot(0, "soir", [PAUL, TOM, LEA])],
      [recipe("a"), recipe("k", { diets: ["keto"], excludedIds: [PAUL, TOM] })],
    );
    expect(cards).toEqual([
      { day: 0, meal_type: "soir", position: 0, recipe_id: "a", member_ids: [PAUL, TOM], locked: false },
      { day: 0, meal_type: "soir", position: 1, recipe_id: "k", member_ids: [LEA], locked: false },
    ]);
  });

  it("ajoute autant de cartes qu'il faut", () => {
    const { cards } = propose(
      [slot(0, "soir", [PAUL, LEA, ZOE])],
      [
        recipe("a"),
        recipe("k", { diets: ["keto"], excludedIds: [PAUL] }),
        recipe("v", { diets: ["vegetarian"], excludedIds: [PAUL] }),
      ],
    );
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.position)).toEqual([0, 1, 2]);
    expect(cards.flatMap((card) => card.member_ids).sort()).toEqual([PAUL, LEA, ZOE].sort());
  });

  it("respecte les exclusions", () => {
    const { cards } = propose(
      [slot(0, "soir", [PAUL, LEA])],
      [recipe("a"), recipe("k", { diets: ["keto"], excludedIds: [PAUL] })],
    );
    expect(cards.find((card) => card.recipe_id === "k")?.member_ids).toEqual([LEA]);
    expect(cards.find((card) => card.recipe_id === "a")?.member_ids).toEqual([PAUL]);
  });

  it("ne prend que des recettes du bon repas", () => {
    const { cards } = propose(
      [slot(2, "pique_nique", [PAUL])],
      [recipe("dinner"), recipe("picnic", { meal_types: ["pique_nique"] })],
    );
    expect(cards.map((card) => card.recipe_id)).toEqual(["picnic"]);
  });

  it("note un membre sans plat quand aucune recette ne lui convient", () => {
    const { cards, unfed } = propose([slot(0, "soir", [PAUL, LEA])], [recipe("a")]);
    expect(cards.map((card) => card.member_ids)).toEqual([[PAUL]]);
    expect(unfed).toEqual([{ day: 0, meal_type: "soir", member_ids: [LEA] }]);
  });
});

describe("proposeWeek : répétitions", () => {
  it("ne sert pas deux fois la même recette hors petit-déj", () => {
    const { cards } = propose(
      [0, 1, 2].map((day) => slot(day, "soir", [PAUL])),
      [recipe("a"), recipe("b"), recipe("c")],
    );
    expect(new Set(cards.map((card) => card.recipe_id)).size).toBe(3);
  });

  it("sert une recette de petit-déj 2 fois au plus, jamais deux jours de suite", () => {
    for (const seed of SEEDS) {
      const { cards } = propose(
        [0, 1, 2, 3, 4, 5, 6].map((day) => slot(day, "petit_dej", [PAUL])),
        ["b1", "b2", "b3", "b4"].map((id) => recipe(id, { meal_types: ["petit_dej"] })),
        { seed },
      );
      expect(cards).toHaveLength(7);
      for (const id of ["b1", "b2", "b3", "b4"]) {
        expect(cards.filter((card) => card.recipe_id === id).length).toBeLessThanOrEqual(2);
      }
      for (const card of cards) {
        const next = cards.find((other) => other.day === card.day + 1);
        if (next) expect(next.recipe_id).not.toBe(card.recipe_id);
      }
    }
  });

  it("à court de recettes, reprend celle servie le plus tôt, pas la veille", () => {
    for (const seed of SEEDS) {
      const { cards } = propose(
        [0, 1, 2, 3].map((day) => slot(day, "soir", [PAUL])),
        [recipe("a"), recipe("b"), recipe("c")],
        { seed },
      );
      const byDay = [0, 1, 2, 3].map((day) => cards.find((card) => card.day === day)?.recipe_id);
      expect(byDay[3]).toBe(byDay[0]);
    }
  });

  it("préfère ne rien proposer que servir deux jours de suite", () => {
    const { cards, unfed } = propose([slot(0, "soir", [PAUL]), slot(1, "soir", [PAUL])], [recipe("a")]);
    expect(cards).toHaveLength(1);
    expect(unfed).toEqual([{ day: 1, meal_type: "soir", member_ids: [PAUL] }]);
  });
});

describe("proposeWeek : verrous", () => {
  const locked: PlannerCard = { day: 0, meal_type: "soir", position: 0, recipe_id: "a", member_ids: [PAUL], locked: true };

  it("sert seulement les membres que les cartes verrouillées ne servent pas", () => {
    const { cards } = propose([slot(0, "soir", [PAUL, LEA])], [recipe("a"), recipe("k", { diets: ["keto"] })], {
      locked: [locked],
    });
    expect(cards).toEqual([
      { day: 0, meal_type: "soir", position: 1, recipe_id: "k", member_ids: [LEA], locked: false },
    ]);
  });

  it("compte la recette verrouillée comme déjà servie", () => {
    const { cards } = propose([slot(0, "soir", [PAUL]), slot(2, "soir", [PAUL])], [recipe("a"), recipe("b")], {
      locked: [locked],
    });
    expect(cards).toEqual([
      { day: 2, meal_type: "soir", position: 0, recipe_id: "b", member_ids: [PAUL], locked: false },
    ]);
  });

  it("ajoute à côté d'une carte verrouillée un plat de sa base, même basique", () => {
    for (const seed of SEEDS) {
      const { cards } = propose(
        [slot(0, "soir", [PAUL, LEA])],
        [
          recipe("frites", { base: "Steak haché", basic: true }),
          recipe("haricots", { base: "steak HACHÉ", basic: true, diets: ["keto"] }),
          recipe("pizza", { diets: ["keto"], favorite: true }),
        ],
        { locked: [{ ...locked, recipe_id: "frites" }], seed },
      );
      expect(cards.map((card) => [card.recipe_id, card.member_ids])).toEqual([["haricots", [LEA]]]);
    }
  });

  it("n'ajoute rien à un créneau entièrement verrouillé", () => {
    const { cards, unfed } = propose([slot(0, "soir", [PAUL])], [recipe("a"), recipe("b")], { locked: [locked] });
    expect(cards).toEqual([]);
    expect(unfed).toEqual([]);
  });
});

describe("proposeWeek : graine et préférences", () => {
  const equals = ["r1", "r2", "r3", "r4", "r5", "r6"].map((id) => recipe(id));
  const twoDinners = [slot(0, "soir", [PAUL]), slot(3, "soir", [PAUL])];

  it("donne le même résultat pour la même graine", () => {
    expect(propose(twoDinners, equals, { seed: 42 })).toEqual(propose(twoDinners, equals, { seed: 42 }));
  });

  it("donne d'autres propositions avec d'autres graines", () => {
    const results = new Set(
      [1, 2, 3, 4, 5].map((seed) => JSON.stringify(propose(twoDinners, equals, { seed }).cards)),
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it("préfère les favoris", () => {
    for (const seed of SEEDS) {
      const { cards } = propose([slot(0, "soir", [PAUL])], [recipe("a"), recipe("fav", { favorite: true })], { seed });
      expect(cards[0].recipe_id).toBe("fav");
    }
  });

  it("préfère le rapide en semaine et le plus long le week-end", () => {
    const recipes = [recipe("quick", { minutes: 20 }), recipe("long", { minutes: 60 })];
    for (const seed of SEEDS) {
      expect(propose([slot(0, "soir", [PAUL])], recipes, { seed }).cards[0].recipe_id).toBe("quick");
      expect(propose([slot(5, "soir", [PAUL])], recipes, { seed }).cards[0].recipe_id).toBe("long");
    }
  });

  it("varie la viande ou le poisson d'un jour à l'autre", () => {
    const recipes = [
      recipe("chicken1", { protein: "volaille" }),
      recipe("chicken2", { protein: "volaille" }),
      recipe("salmon", { protein: "poisson" }),
    ];
    for (const seed of SEEDS) {
      const { cards } = propose([slot(0, "soir", [PAUL]), slot(1, "soir", [PAUL])], recipes, { seed });
      const protein = (day: number) => recipes.find((item) => item.id === cards.find((card) => card.day === day)?.recipe_id)?.protein;
      expect(protein(1)).not.toBe(protein(0));
    }
  });
});

// Le foyer de test de CLAUDE.md, sur les 40 recettes du catalogue
// [n, repas, régimes, minutes, famille, base].
const CATALOG: [string, MealType[], Diet[], number, string | null, string?][] = [
  ["1", ["petit_dej"], ["vegetarian"], 5, null],
  ["2", ["petit_dej"], ["vegetarian"], 15, null],
  ["3", ["petit_dej"], ["vegetarian"], 30, null],
  ["4", ["petit_dej"], ["vegetarian"], 10, null],
  ["5", ["petit_dej"], ["vegetarian"], 20, null],
  ["6", ["petit_dej"], ["vegetarian"], 35, null],
  ["7", ["petit_dej"], ["vegetarian"], 40, null],
  ["8", ["petit_dej"], ["vegetarian"], 10, null],
  ["9", ["petit_dej"], ["keto", "gluten_free"], 13, "porc"],
  ["10", ["petit_dej"], ["keto", "vegetarian", "gluten_free", "lactose_free"], 5, null],
  ["11", ["petit_dej"], ["keto", "gluten_free"], 30, "porc"],
  ["12", ["soir"], [], 75, "boeuf"],
  ["13", ["soir"], ["gluten_free"], 60, "boeuf"],
  ["14", ["soir", "midi"], [], 40, "porc"],
  ["15", ["soir"], ["gluten_free", "lactose_free"], 90, "volaille", "Poulet"],
  ["16", ["soir", "midi"], [], 50, "porc"],
  ["17", ["soir"], ["vegetarian", "gluten_free"], 45, null],
  ["18", ["soir"], ["gluten_free", "lactose_free"], 80, "boeuf"],
  ["19", ["soir"], [], 20, "porc"],
  ["20", ["soir"], ["vegetarian", "gluten_free", "lactose_free"], 40, null],
  ["21", ["soir"], ["keto", "gluten_free"], 40, "volaille", "Poulet"],
  ["22", ["soir"], ["keto", "gluten_free"], 30, "poisson", "Saumon"],
  ["23", ["soir"], ["keto", "gluten_free"], 50, "boeuf"],
  ["24", ["soir"], ["keto", "gluten_free"], 50, "porc"],
  ["25", ["soir"], ["keto", "gluten_free"], 45, "porc"],
  ["26", ["soir"], ["keto", "gluten_free"], 55, "boeuf"],
  ["27", ["midi"], ["keto", "gluten_free", "lactose_free"], 25, "volaille"],
  ["28", ["midi"], ["keto", "gluten_free", "lactose_free"], 25, null],
  ["29", ["midi"], ["keto", "gluten_free", "lactose_free"], 25, null],
  ["30", ["midi"], ["keto", "gluten_free", "lactose_free"], 20, "volaille"],
  ["31", ["midi"], ["keto", "vegetarian", "gluten_free"], 40, null],
  ["32", ["midi"], ["keto", "gluten_free"], 10, "poisson"],
  ["33", ["midi"], ["keto", "gluten_free", "lactose_free"], 30, "volaille"],
  ["34", ["midi"], ["keto", "gluten_free"], 10, "porc"],
  ["35", ["pique_nique"], ["vegetarian", "lactose_free"], 10, null],
  ["36", ["pique_nique"], [], 10, "porc"],
  ["37", ["pique_nique", "midi"], ["lactose_free"], 20, null],
  ["38", ["pique_nique"], [], 35, "porc"],
  ["39", ["pique_nique"], ["vegetarian"], 10, null],
  ["40", ["pique_nique"], [], 10, "volaille"],
];

describe("proposeWeek : foyer de test", () => {
  const [olivier, marieLaure, timothe, annaLucia, otis] = ["olivier", "marie-laure", "timothe", "anna-lucia", "otis"];
  const family = [olivier, marieLaure, timothe, annaLucia, otis];
  const members: PlannerMember[] = family.map((id) => ({ id, diets: id === marieLaure ? ["keto"] : [] }));
  const recipes = CATALOG.map(([id, meal_types, diets, minutes, protein]) =>
    recipe(id, { meal_types, diets, minutes, protein }),
  );
  const slots: PlannerSlot[] = [
    ...[0, 1, 2, 3, 4, 5, 6].flatMap((day) => [slot(day, "petit_dej", family), slot(day, "soir", family)]),
    ...[0, 1, 3, 4].map((day) => slot(day, "midi", [marieLaure])),
    slot(2, "pique_nique", [annaLucia, otis]),
  ];

  it.each(SEEDS)("sert chaque présent une fois, avec un plat qui lui convient (graine %i)", (seed) => {
    const { cards, unfed } = proposeWeek({ slots, members, recipes, locked: [], seed });
    expect(unfed).toEqual([]);
    for (const { day, meal_type, member_ids } of slots) {
      const here = cards.filter((card) => card.day === day && card.meal_type === meal_type);
      expect(here.flatMap((card) => card.member_ids).sort()).toEqual([...member_ids].sort());
      for (const card of here) {
        const dish = recipes.find((item) => item.id === card.recipe_id)!;
        expect(dish.meal_types).toContain(meal_type);
        for (const id of card.member_ids) expect(canEat(dish, members.find((member) => member.id === id)!)).toBe(true);
      }
    }
    // Jamais la même recette deux jours de suite.
    for (const card of cards) {
      expect(cards.some((other) => other.recipe_id === card.recipe_id && other.day === card.day + 1)).toBe(false);
    }
  });

});

describe("proposeWeek et nextIdea : les basiques", () => {
  it("ne propose jamais une recette basique", () => {
    for (const seed of SEEDS) {
      const { cards } = propose(
        [slot(0, "soir", [PAUL, TOM]), slot(1, "soir", [PAUL, TOM])],
        [recipe("basique", { basic: true, favorite: true, minutes: 10 }), recipe("a"), recipe("b")],
        { seed },
      );
      expect(cards.map((card) => card.recipe_id)).not.toContain("basique");
    }
  });

  it("garde une carte verrouillée sur une basique et tient compte de sa viande", () => {
    const locked: PlannerCard = {
      day: 0,
      meal_type: "soir",
      position: 0,
      recipe_id: "steak-frites",
      member_ids: [PAUL, TOM],
      locked: true,
    };
    const recipes = [
      recipe("steak-frites", { basic: true, protein: "boeuf" }),
      recipe("boeuf", { protein: "boeuf" }),
      recipe("poulet", { protein: "volaille" }),
    ];
    for (const seed of SEEDS) {
      const { cards } = propose([slot(0, "soir", [PAUL, TOM]), slot(1, "soir", [PAUL, TOM])], recipes, { locked: [locked], seed });
      expect(cards).toHaveLength(1);
      expect(cards[0].recipe_id).toBe("poulet");
    }
  });

  it("ne propose pas une basique comme autre idée", () => {
    const card: PlannerCard = { day: 0, meal_type: "soir", position: 0, recipe_id: "a", member_ids: [PAUL], locked: false };
    expect(
      nextIdea({ card, cards: [], members: MEMBERS, recipes: [recipe("a"), recipe("basique", { basic: true })], tried: [], seed: 1 }),
    ).toBeNull();
  });
});

describe("mainProtein", () => {
  it("prend le premier ingrédient de la boucherie ou de la poissonnerie", () => {
    expect(
      mainProtein([
        { name: "Pommes de terre", aisle: "fruits_legumes" },
        { name: "Blancs de poulet", aisle: "boucherie" },
        { name: "Lardons", aisle: "boucherie" },
      ]),
    ).toBe("volaille");
    expect(mainProtein([{ name: "Tranches de jambon blanc", aisle: "boucherie" }])).toBe("porc");
    expect(mainProtein([{ name: "Bœuf haché", aisle: "boucherie" }])).toBe("boeuf");
    expect(mainProtein([{ name: "Pavés de saumon", aisle: "poissonnerie" }])).toBe("poisson");
  });

  it("garde le nom d'une viande inconnue, et rien sans viande ni poisson", () => {
    expect(mainProtein([{ name: "Lapin", aisle: "boucherie" }])).toBe("lapin");
    expect(mainProtein([{ name: "Pois chiches", aisle: "epicerie" }])).toBeNull();
  });
});

// Les 35 basiques du catalogue (recettes-basiques.json), telles que la semaine les reçoit.
const DIET_OF: Record<string, Diet> = {
  keto: "keto",
  vegetarien: "vegetarian",
  sans_gluten: "gluten_free",
  sans_lactose: "lactose_free",
};
const BASICS: PlannerRecipe[] = basicsFile.recettes.map((item) =>
  recipe(item.titre, {
    meal_types: item.types as MealType[],
    diets: item.regimes.map((diet) => DIET_OF[diet]),
    minutes: item.prep + item.cuisson,
    protein: mainProtein(item.ingredients.map(([name, , , aisle]) => ({ name: String(name), aisle: aisle as GroceryAisle }))),
    base: item.base,
    basic: item.basique,
  }),
);

describe("proposeWeek : foyer de test, avec les basiques", () => {
  const [olivier, marieLaure, timothe, annaLucia, otis] = ["olivier", "marie-laure", "timothe", "anna-lucia", "otis"];
  const family = [olivier, marieLaure, timothe, annaLucia, otis];
  const others = [olivier, timothe, annaLucia, otis];
  const members: PlannerMember[] = family.map((id) => ({ id, diets: id === marieLaure ? ["keto"] : [] }));
  const recipes = [
    ...CATALOG.map(([id, meal_types, diets, minutes, protein, base]) =>
      recipe(id, { meal_types, diets, minutes, protein, base: base ?? null }),
    ),
    ...BASICS,
  ];
  const byId = new Map(recipes.map((item) => [item.id, item]));
  const dish = (card: PlannerCard) => byId.get(card.recipe_id)!;
  const slots: PlannerSlot[] = [
    ...[0, 1, 2, 3, 4, 5, 6].flatMap((day) => [slot(day, "petit_dej", family), slot(day, "soir", family)]),
    ...[0, 1, 3, 4].map((day) => slot(day, "midi", [marieLaure])),
    slot(2, "pique_nique", [annaLucia, otis]),
  ];
  const week = (seed: number) => proposeWeek({ slots, members, recipes, locked: [], seed });
  const at = (cards: PlannerCard[], day: number, meal: MealType) =>
    cards.filter((card) => card.day === day && card.meal_type === meal);

  it.each(SEEDS)("lundi soir : un duo de même base, le plat céto pour Marie-Laure seule (graine %i)", (seed) => {
    const monday = at(week(seed).cards, 0, "soir");
    expect(monday).toHaveLength(2);
    const hers = monday.find((card) => card.member_ids.includes(marieLaure))!;
    const theirs = monday.find((card) => card !== hers)!;
    expect(hers.member_ids).toEqual([marieLaure]);
    expect([...theirs.member_ids].sort()).toEqual([...others].sort());
    expect(dish(hers).diets).toContain("keto");
    expect(dish(theirs).diets).not.toContain("keto");
    expect(baseKey(dish(theirs).base)).not.toBeNull();
    expect(baseKey(dish(theirs).base)).toBe(baseKey(dish(hers).base));
  });

  it.each(SEEDS)("midi de Marie-Laure : une seule carte céto, jamais une basique (graine %i)", (seed) => {
    const { cards } = week(seed);
    for (const day of [0, 1, 3, 4]) {
      const lunch = at(cards, day, "midi");
      expect(lunch).toHaveLength(1);
      expect(dish(lunch[0]).diets).toContain("keto");
      expect(dish(lunch[0]).basic).toBeFalsy();
    }
  });

  it.each(SEEDS)("mercredi pique-nique : un plat pour Otis et Anna-Lucia (graine %i)", (seed) => {
    const picnic = at(week(seed).cards, 2, "pique_nique");
    expect(picnic).toHaveLength(1);
    expect([...picnic[0].member_ids].sort()).toEqual([annaLucia, otis].sort());
  });

  it.each(SEEDS)("une basique n'est jamais seule dans son repas (graine %i)", (seed) => {
    const { cards } = week(seed);
    for (const card of cards.filter((item) => dish(item).basic)) {
      const partners = at(cards, card.day, card.meal_type).filter((other) => other !== card);
      expect(partners.some((other) => baseKey(dish(other).base) === baseKey(dish(card).base))).toBe(true);
    }
  });

  it.each(SEEDS)("ne répète pas une base quand il y a le choix (graine %i)", (seed) => {
    const dinners = [0, 1, 2].map((day) => slot(day, "soir", family));
    const { cards } = proposeWeek({ slots: dinners, members, recipes, locked: [], seed });
    const bases = [0, 1, 2].map((day) => baseKey(dish(at(cards, day, "soir")[0]).base));
    expect(new Set(bases).size).toBe(3);
  });

  it("même graine, même semaine ; autre graine, autre semaine", () => {
    expect(week(7)).toEqual(week(7));
    expect(new Set(SEEDS.map((seed) => JSON.stringify(week(seed).cards))).size).toBeGreaterThan(1);
  });

  it.each(SEEDS)("foyer sans régime : un seul plat par repas, jamais une basique (graine %i)", (seed) => {
    const plain = members.map((member) => ({ ...member, diets: [] }));
    const { cards, unfed } = proposeWeek({ slots, members: plain, recipes, locked: [], seed });
    expect(unfed).toEqual([]);
    for (const { day, meal_type } of slots) expect(at(cards, day, meal_type)).toHaveLength(1);
    expect(cards.some((card) => dish(card).basic)).toBe(false);
  });
});

describe("nextIdea", () => {
  const card: PlannerCard = { day: 0, meal_type: "soir", position: 0, recipe_id: "a", member_ids: [PAUL], locked: false };
  const recipes = [recipe("a"), recipe("b"), recipe("c")];

  function idea(tried: string[], overrides: Partial<Parameters<typeof nextIdea>[0]> = {}) {
    return nextIdea({ card, cards: [], members: MEMBERS, recipes, tried, seed: 1, ...overrides });
  }

  it("propose une autre recette, jamais une déjà essayée", () => {
    const first = idea([])!.recipe_id;
    expect(["b", "c"]).toContain(first);
    const second = idea([first])!.recipe_id;
    expect(["b", "c"]).toContain(second);
    expect(second).not.toBe(first);
  });

  it("ne rend rien quand tout a été essayé", () => {
    expect(idea(["b", "c"])).toBeNull();
  });

  it("choisit une recette qui convient à tous les mangeurs de la carte", () => {
    const ketoCard: PlannerCard = { ...card, recipe_id: "k1", member_ids: [PAUL, LEA] };
    const result = idea([], {
      card: ketoCard,
      recipes: [recipe("k1", { diets: ["keto"] }), recipe("k2", { diets: ["keto"] }), recipe("a")],
    });
    expect(result).toEqual({ recipe_id: "k2" });
  });

  it("évite une recette déjà dans la semaine", () => {
    const others: PlannerCard[] = [{ ...card, day: 3, recipe_id: "b" }];
    expect(idea([], { cards: others })).toEqual({ recipe_id: "c" });
  });

  describe("sur un duo de même base", () => {
    const duoRecipes = [
      recipe("sh-frites", { base: "Steak haché", basic: true }),
      recipe("sh-haricots", { base: "Steak haché", basic: true, diets: ["keto"] }),
      recipe("sh-puree", { base: "Steak haché", basic: true }),
      recipe("po-riz", { base: "Poulet", basic: true }),
      recipe("po-brocolis", { base: "Poulet", basic: true, diets: ["keto"] }),
      recipe("lasagnes"),
    ];
    const theirs: PlannerCard = { day: 0, meal_type: "soir", position: 0, recipe_id: "sh-frites", member_ids: [PAUL, TOM], locked: false };
    const hers: PlannerCard = { day: 0, meal_type: "soir", position: 1, recipe_id: "sh-haricots", member_ids: [LEA], locked: false };
    const duoIdea = (partner: PlannerCard, tried: string[] = []) =>
      nextIdea({ card: theirs, cards: [partner], members: MEMBERS, recipes: duoRecipes, tried, seed: 1 });

    it("l'autre plat libre : un nouveau duo pour les deux, sur une autre base", () => {
      expect(duoIdea(hers)).toEqual({ recipe_id: "po-riz", partner: { card: hers, recipe_id: "po-brocolis" } });
    });

    it("l'autre plat verrouillé : une autre recette de sa base", () => {
      expect(duoIdea({ ...hers, locked: true })).toEqual({ recipe_id: "sh-puree" });
    });

    it("plus d'autre base à essayer : une idée ordinaire, pour ce plat seul", () => {
      expect(duoIdea(hers, ["po-riz"])).toEqual({ recipe_id: "lasagnes" });
    });
  });
});
