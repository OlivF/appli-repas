import { describe, expect, it } from "vitest";
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
  it("prend une recette pour tous quand elle existe", () => {
    const { cards } = propose([slot(0, "soir", [PAUL, LEA])], [recipe("a"), recipe("k", { diets: ["keto"] })]);
    expect(cards).toEqual([
      { day: 0, meal_type: "soir", position: 0, recipe_id: "k", member_ids: [PAUL, LEA], locked: false },
    ]);
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
// [n, repas, régimes, minutes, famille].
const CATALOG: [string, MealType[], Diet[], number, string | null][] = [
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
  ["15", ["soir"], ["gluten_free", "lactose_free"], 90, "volaille"],
  ["16", ["soir", "midi"], [], 50, "porc"],
  ["17", ["soir"], ["vegetarian", "gluten_free"], 45, null],
  ["18", ["soir"], ["gluten_free", "lactose_free"], 80, "boeuf"],
  ["19", ["soir"], [], 20, "porc"],
  ["20", ["soir"], ["vegetarian", "gluten_free", "lactose_free"], 40, null],
  ["21", ["soir"], ["keto", "gluten_free"], 40, "volaille"],
  ["22", ["soir"], ["keto", "gluten_free"], 30, "poisson"],
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

  it("propose un dîner céto pour toute la famille du lundi au samedi", () => {
    const { cards } = proposeWeek({ slots, members, recipes, locked: [], seed: 1 });
    for (const day of [0, 1, 2, 3, 4, 5]) {
      const dinners = cards.filter((card) => card.day === day && card.meal_type === "soir");
      expect(dinners).toHaveLength(1);
      expect(dinners[0].member_ids).toHaveLength(5);
    }
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

describe("nextIdea", () => {
  const card: PlannerCard = { day: 0, meal_type: "soir", position: 0, recipe_id: "a", member_ids: [PAUL], locked: false };
  const recipes = [recipe("a"), recipe("b"), recipe("c")];

  function idea(tried: string[], overrides: Partial<Parameters<typeof nextIdea>[0]> = {}) {
    return nextIdea({ card, cards: [], members: MEMBERS, recipes, tried, seed: 1, ...overrides });
  }

  it("propose une autre recette, jamais une déjà essayée", () => {
    const first = idea([]);
    expect(["b", "c"]).toContain(first);
    const second = idea([first!]);
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
    expect(result).toBe("k2");
  });

  it("évite une recette déjà dans la semaine", () => {
    const others: PlannerCard[] = [{ ...card, day: 3, recipe_id: "b" }];
    expect(idea([], { cards: others })).toBe("c");
  });
});
