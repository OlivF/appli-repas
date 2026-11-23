import { describe, expect, it } from "vitest";
import { buildBoard, canDropOn, clearableCards, extrasToAdd, leavingNote, menuBase, moveEaters, restorableEaters, trimCards, type BoardDrag } from "@/lib/board";
import { weekSlots, type SlotInput } from "@/lib/meal-slots";
import type { PlannerMember } from "@/lib/planner";
import type { Course } from "@/lib/recipes";
import { LEA, PAUL, TOM } from "@/test/helpers";

function card(id: string, day: number, meal_type: SlotInput["meal_type"], position: number, member_ids: string[]) {
  return { id, day, meal_type, position, member_ids, recipe_id: `r-${id}`, locked: false };
}

describe("buildBoard", () => {
  it("ne garde que les lignes qui ont au moins un créneau", () => {
    const board = buildBoard([{ day: 0, meal_type: "soir", member_ids: [PAUL] }], []);
    expect(board.map((row) => row.row)).toEqual(["soir"]);
    expect(board[0].label).toBe("Dîner");
    expect(board[0].days).toHaveLength(7);
    expect(board[0].days[1].slots).toEqual([]);
  });

  it("range le pique-nique dans la ligne du midi, après le midi", () => {
    const board = buildBoard(
      [
        { day: 2, meal_type: "pique_nique", member_ids: [TOM] },
        { day: 2, meal_type: "midi", member_ids: [LEA] },
        { day: 0, meal_type: "petit_dej", member_ids: [PAUL] },
      ],
      [],
    );
    expect(board.map((row) => row.row)).toEqual(["petit_dej", "midi"]);
    expect(board[1].days[2].slots.map((slot) => slot.meal_type)).toEqual(["midi", "pique_nique"]);
  });

  it("pose les cartes dans leur créneau, par position, et ignore celles d'un créneau disparu", () => {
    const board = buildBoard(
      [{ day: 0, meal_type: "soir", member_ids: [PAUL, LEA] }],
      [card("b", 0, "soir", 1, [LEA]), card("a", 0, "soir", 0, [PAUL]), card("orphan", 3, "soir", 0, [PAUL])],
    );
    expect(board[0].days[0].slots[0].cards.map((item) => item.id)).toEqual(["a", "b"]);
    expect(board[0].days[3].slots).toEqual([]);
  });

  it("signale les présents qui n'ont pas de plat", () => {
    const board = buildBoard(
      [{ day: 0, meal_type: "soir", member_ids: [PAUL, LEA, TOM] }],
      [card("a", 0, "soir", 0, [PAUL])],
    );
    expect(board[0].days[0].slots[0].unfed).toEqual([LEA, TOM]);
  });

  it("ne signale personne dans un créneau encore vide", () => {
    const board = buildBoard([{ day: 0, meal_type: "soir", member_ids: [PAUL] }], []);
    expect(board[0].days[0].slots[0].unfed).toEqual([]);
  });
});

describe("menuBase", () => {
  const bases: Record<string, string | null> = {
    "r-famille": "Steak haché",
    "r-lea": "Poulet",
    "r-sans": null,
    "r-mardi": "Saumon",
  };
  const baseOf = (recipeId: string) => bases[recipeId];
  const cards = [
    card("lea", 0, "soir", 1, [LEA]),
    card("famille", 0, "soir", 0, [PAUL, TOM]),
    card("mardi", 1, "soir", 0, [PAUL]),
  ];

  it("donne la base des autres plats du repas avant celle du plat qu'on change", () => {
    expect(menuBase(cards, baseOf, { day: 0, meal_type: "soir", cardId: "lea" })).toBe("Steak haché");
  });

  it("garde la base du plat qu'on change quand les autres n'en ont pas", () => {
    const others = [card("lea", 0, "soir", 1, [LEA]), { ...card("famille", 0, "soir", 0, [PAUL]), recipe_id: "r-sans" }];
    expect(menuBase(others, baseOf, { day: 0, meal_type: "soir", cardId: "lea" })).toBe("Poulet");
  });

  it("suit l'ordre des plats pour un créneau à compléter, sans regarder les autres repas", () => {
    expect(menuBase(cards, baseOf, { day: 0, meal_type: "soir" })).toBe("Steak haché");
    expect(menuBase(cards, baseOf, { day: 2, meal_type: "soir" })).toBeNull();
  });
});

describe("moveEaters", () => {
  const ZOE = "44444444-4444-4444-8444-444444444444";
  const cards = [
    card("famille", 0, "soir", 0, [PAUL, TOM, ZOE]),
    card("lea", 0, "soir", 1, [LEA]),
    card("mardi", 1, "soir", 0, [PAUL, TOM]),
  ];
  const eatersOf = (list: ReturnType<typeof moveEaters<(typeof cards)[number]>>) =>
    Object.fromEntries(list.map((item) => [item.id, item.member_ids]));

  it("met les mangeurs sur le plat, les retire des autres plats du repas, et verrouille le plat", () => {
    const result = moveEaters(cards, "lea", [LEA, TOM]);
    expect(eatersOf(result)).toEqual({ famille: [PAUL, ZOE], lea: [LEA, TOM], mardi: [PAUL, TOM] });
    expect(result.find((item) => item.id === "lea")?.locked).toBe(true);
    expect(result.find((item) => item.id === "famille")?.locked).toBe(false);
  });

  it("fait disparaître un plat qui n'a plus personne", () => {
    const result = moveEaters(cards, "lea", [LEA, PAUL, TOM, ZOE]);
    expect(result.map((item) => item.id)).toEqual(["lea", "mardi"]);
  });

  it("ne touche pas aux autres repas", () => {
    const result = moveEaters(cards, "famille", [PAUL]);
    expect(eatersOf(result).mardi).toEqual([PAUL, TOM]);
  });
});

// ─── Desserts, fruits, fromages : le foyer de test ──────────────────────────
const OLIVIER = "o";
const ML = "ml";
const TIMOTHE = "t";
const ANNA = "a";
const OTIS = "x";
const ALL = [OLIVIER, ML, TIMOTHE, ANNA, OTIS];
const HOUSEHOLD: PlannerMember[] = [
  { id: OLIVIER, diets: [] },
  { id: ML, diets: ["keto"] },
  { id: TIMOTHE, diets: [] },
  { id: ANNA, diets: [] },
  { id: OTIS, diets: [] },
];
// Petit-déj et dîner pour tous ; midi Marie-Laure lun/mar/jeu/ven ; mercredi pique-nique Otis + Anna-Lucia.
const SLOTS: SlotInput[] = [
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((day) => [
    { day, meal_type: "petit_dej" as const, member_ids: ALL },
    { day, meal_type: "soir" as const, member_ids: ALL },
  ]),
  ...[0, 1, 3, 4].map((day) => ({ day, meal_type: "midi" as const, member_ids: [ML] })),
  { day: 2, meal_type: "pique_nique", member_ids: [ANNA, OTIS] },
];

function dish(id: string, course: Course, position: number, member_ids: string[], day = 0) {
  return { ...card(id, day, "soir", position, member_ids), course };
}

describe("buildBoard : desserts, fruits, fromages", () => {
  const dinner = (cards: ReturnType<typeof dish>[]) => buildBoard([{ day: 0, meal_type: "soir", member_ids: ALL }], cards)[0].days[0].slots[0];

  it("un plat pour tous, un yaourt pour tous, du comté pour Marie-Laure : personne n'est oublié", () => {
    const slot = dinner([dish("gratin", "main", 0, ALL), dish("yaourt", "dairy", 1, ALL), dish("comte", "cheese", 2, [ML])]);
    expect(slot.cards.map((item) => item.id)).toEqual(["gratin"]);
    expect(slot.extras.map((item) => item.id)).toEqual(["yaourt", "comte"]);
    expect(slot.starters).toEqual([]);
    expect(slot.unfed).toEqual([]);
  });

  it("un repas qui n'a qu'un yaourt est toujours à remplir", () => {
    const slot = dinner([dish("yaourt", "dairy", 0, ALL)]);
    expect(slot.cards).toEqual([]);
    expect(slot.unfed).toEqual([]);
    expect(slot.extras.map((item) => item.id)).toEqual(["yaourt"]);
  });

  it("seuls les plats nourrissent : du comté ne remplace pas un plat", () => {
    const slot = dinner([dish("gratin", "main", 0, [OLIVIER, TIMOTHE, ANNA, OTIS]), dish("comte", "cheese", 1, [ML])]);
    expect(slot.unfed).toEqual([ML]);
  });

  it("les entrées à part ; la fin du repas dans l'ordre laitage, fruit, fromage, dessert, puis par position", () => {
    const slot = dinner([
      dish("mousse", "dessert", 1, ALL),
      dish("comte", "cheese", 2, [ML]),
      dish("pomme", "fruit", 3, ALL),
      dish("yaourt", "dairy", 4, ALL),
      dish("petits-suisses", "dairy", 0, [OTIS]),
      dish("carottes", "starter", 5, ALL),
      dish("gratin", "main", 6, ALL),
    ]);
    expect(slot.starters.map((item) => item.id)).toEqual(["carottes"]);
    expect(slot.cards.map((item) => item.id)).toEqual(["gratin"]);
    expect(slot.extras.map((item) => item.id)).toEqual(["petits-suisses", "yaourt", "pomme", "comte", "mousse"]);
  });
});

describe("moveEaters : desserts, fruits, fromages", () => {
  const cards = [
    { ...dish("gratin", "main", 0, [OLIVIER, TIMOTHE, ANNA, OTIS]), locked: false },
    { ...dish("poulet", "main", 1, [ML]), locked: false },
    { ...dish("yaourt", "dairy", 2, ALL), locked: false },
  ];
  const eatersOf = (list: typeof cards) => Object.fromEntries(list.map((item) => [item.id, item.member_ids]));

  it("mettre Otis sur le second plat ne lui retire pas son yaourt", () => {
    const result = moveEaters(cards, "poulet", [ML, OTIS]);
    expect(eatersOf(result)).toEqual({ gratin: [OLIVIER, TIMOTHE, ANNA], poulet: [ML, OTIS], yaourt: ALL });
  });

  it("changer qui mange le yaourt ne touche ni aux plats ni à son verrou", () => {
    const result = moveEaters(cards, "yaourt", [OTIS]);
    expect(eatersOf(result)).toEqual({ gratin: [OLIVIER, TIMOTHE, ANNA, OTIS], poulet: [ML], yaourt: [OTIS] });
    expect(result.find((item) => item.id === "yaourt")?.locked).toBe(false);
  });
});

describe("menuBase : desserts, fruits, fromages", () => {
  it("ne regarde que les plats", () => {
    const cards = [dish("yaourt", "dairy", 0, ALL), dish("gratin", "main", 1, ALL)];
    const bases: Record<string, string> = { "r-yaourt": "Yaourt", "r-gratin": "Courgettes" };
    expect(menuBase(cards, (recipeId) => bases[recipeId], { day: 0, meal_type: "soir" })).toBe("Courgettes");
  });
});

describe("extrasToAdd", () => {
  const yaourt = { id: "yaourt", diets: ["vegetarian", "gluten_free"] as const, excludedIds: [] };
  const pomme = { id: "pomme", diets: ["vegetarian", "gluten_free", "lactose_free"] as const, excludedIds: [] };
  const comte = { id: "comte", diets: ["vegetarian", "gluten_free", "lactose_free", "keto"] as const, excludedIds: [] };
  const add = (input: Partial<Parameters<typeof extrasToAdd>[0]> & Pick<Parameters<typeof extrasToAdd>[0], "recipes" | "target">) =>
    extrasToAdd({ eaterIds: ALL, slots: SLOTS, cards: [], members: HOUSEHOLD, ...input });

  it("« Yaourt nature » et « Pomme » pour toute la famille à tous les dîners", () => {
    const { items, unserved } = add({ recipes: [yaourt, pomme], target: { meal_type: "soir", fromDay: 0 } });
    const yaourts = items.filter((item) => item.recipe_id === "yaourt");
    const pommes = items.filter((item) => item.recipe_id === "pomme");
    const family = [OLIVIER, TIMOTHE, ANNA, OTIS];
    expect(yaourts.map((item) => item.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // Marie-Laure (céto) n'a d'office ni le yaourt nature ni la pomme (régimes de recettes-legeres.json).
    expect(yaourts.every((item) => item.meal_type === "soir" && item.member_ids.join() === family.join())).toBe(true);
    expect(yaourts.reduce((sum, item) => sum + item.member_ids.length, 0)).toBe(28);
    expect(pommes).toHaveLength(7);
    expect(pommes.every((item) => item.member_ids.join() === family.join())).toBe(true);
    expect(unserved).toEqual([0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, meal_type: "soir", member_ids: [ML] })));
  });

  it("« Tous les midis » ne vise pas le pique-nique du mercredi", () => {
    const { items } = add({ recipes: [comte], target: { meal_type: "midi", fromDay: 0 } });
    expect(items.map((item) => [item.day, item.meal_type, item.member_ids])).toEqual([
      [0, "midi", [ML]],
      [1, "midi", [ML]],
      [3, "midi", [ML]],
      [4, "midi", [ML]],
    ]);
  });

  it("semaine en cours, ouvert un mercredi : à partir d'aujourd'hui", () => {
    const { items } = add({ recipes: [yaourt], target: { meal_type: "soir", fromDay: 2 } });
    expect(items.map((item) => item.day)).toEqual([2, 3, 4, 5, 6]);
  });

  it("seulement les choisis présents au repas", () => {
    const { items, unserved } = add({ recipes: [pomme], target: { day: 2, meal_type: "pique_nique" } });
    expect(items).toEqual([{ day: 2, meal_type: "pique_nique", recipe_id: "pomme", member_ids: [ANNA, OTIS] }]);
    expect(unserved).toEqual([]);
  });

  it("fusionne sur un yaourt déjà là pour Otis seul", () => {
    const cards = [{ id: "c-yaourt", day: 0, meal_type: "soir" as const, recipe_id: "yaourt", member_ids: [OTIS] }];
    const { items } = add({ recipes: [yaourt], target: { day: 0, meal_type: "soir" }, cards });
    expect(items).toEqual([
      { day: 0, meal_type: "soir", recipe_id: "yaourt", member_ids: [OTIS, OLIVIER, TIMOTHE, ANNA], cardId: "c-yaourt" },
    ]);
  });

  it("rien à envoyer pour un yaourt qui a déjà tout le monde, ni pour une recette que personne ne peut manger", () => {
    const cards = [{ id: "c-yaourt", day: 0, meal_type: "soir" as const, recipe_id: "yaourt", member_ids: ALL }];
    expect(add({ recipes: [yaourt], target: { day: 0, meal_type: "soir" }, cards }).items).toEqual([]);
    const { items, unserved } = add({ recipes: [pomme], eaterIds: [ML], target: { day: 0, meal_type: "soir" } });
    expect(items).toEqual([]);
    expect(unserved).toEqual([{ day: 0, meal_type: "soir", member_ids: [ML] }]);
  });

  it("respecte les membres exclus d'une recette", () => {
    const { items } = add({ recipes: [{ ...comte, excludedIds: [TIMOTHE] }], target: { day: 0, meal_type: "soir" } });
    expect(items[0].member_ids).toEqual([OLIVIER, ML, ANNA, OTIS]);
  });
});

// ─── La corbeille ───────────────────────────────────────────────────────────
describe("canDropOn", () => {
  const meals: Record<string, SlotInput["meal_type"][]> = { "r-a": ["soir"], "r-b": ["soir"], "r-c": ["midi", "soir"] };
  const fits = (recipeId: string, mealType: SlotInput["meal_type"]) => meals[recipeId]?.includes(mealType) ?? false;
  const free = card("a", 0, "soir", 0, [OLIVIER]);
  const locked = { ...card("b", 1, "soir", 0, [OLIVIER]), locked: true };
  const other = card("c", 2, "soir", 0, [OLIVIER]);
  const cards = [free, locked, other];
  const drop = (drag: BoardDrag, target: string) => canDropOn(drag, target, cards, fits);

  it("la corbeille accepte un plat, même verrouillé, et une puce", () => {
    expect(drop({ kind: "card", card: free }, "trash")).toBe(true);
    expect(drop({ kind: "card", card: locked }, "trash")).toBe(true);
    expect(drop({ kind: "extra", card: other }, "trash")).toBe(true);
  });

  it("une recette de la Bibliothèque ne va jamais à la corbeille", () => {
    expect(drop({ kind: "recipe", recipe: { meal_types: ["soir"] } }, "trash")).toBe(false);
  });

  it("un plat verrouillé ne va qu'à la corbeille", () => {
    expect(drop({ kind: "card", card: locked }, "card:c")).toBe(false);
    expect(drop({ kind: "card", card: locked }, "slot:3:soir")).toBe(false);
    expect(drop({ kind: "card", card: locked }, "add:3:soir")).toBe(false);
  });

  it("une puce ne va qu'à la corbeille", () => {
    expect(drop({ kind: "extra", card: other }, "card:a")).toBe(false);
    expect(drop({ kind: "extra", card: other }, "slot:3:soir")).toBe(false);
    expect(drop({ kind: "extra", card: other }, "add:3:soir")).toBe(false);
  });

  it("garde les règles d'avant : échange si chaque recette va au repas de l'autre, jamais sur un verrouillé", () => {
    expect(drop({ kind: "card", card: free }, "card:c")).toBe(true);
    expect(drop({ kind: "card", card: free }, "card:a")).toBe(false);
    expect(drop({ kind: "card", card: free }, "card:b")).toBe(false);
    expect(drop({ kind: "card", card: { ...free, recipe_id: "r-x" } }, "card:c")).toBe(false);
  });

  it("garde les règles d'avant : une recette va sur un repas qui lui convient", () => {
    expect(drop({ kind: "recipe", recipe: { meal_types: ["soir"] } }, "card:a")).toBe(true);
    expect(drop({ kind: "recipe", recipe: { meal_types: ["soir"] } }, "card:b")).toBe(false);
    expect(drop({ kind: "recipe", recipe: { meal_types: ["midi"] } }, "card:a")).toBe(false);
    expect(drop({ kind: "recipe", recipe: { meal_types: ["midi"] } }, "slot:0:midi")).toBe(true);
    expect(drop({ kind: "recipe", recipe: { meal_types: ["midi"] } }, "add:0:soir")).toBe(false);
    expect(drop({ kind: "card", card: free }, "slot:0:soir")).toBe(false);
  });
});

describe("restorableEaters", () => {
  const roast = dish("roti", "main", 0, [OLIVIER, TIMOTHE]);

  it("un plat : ceux qui ont déjà un autre plat au repas restent où ils sont", () => {
    const now = [dish("pates", "main", 0, [TIMOTHE, ANNA, OTIS])];
    expect(restorableEaters({ card: roast, cards: now, presentIds: ALL })).toEqual([OLIVIER]);
  });

  it("un plat : un absent du repas ne revient pas", () => {
    expect(restorableEaters({ card: roast, cards: [], presentIds: [TIMOTHE, ML] })).toEqual([TIMOTHE]);
  });

  it("un plat : les desserts des autres ne comptent pas, ni les plats d'un autre repas", () => {
    const now = [dish("yaourt", "dairy", 1, ALL), dish("pates", "main", 0, [OLIVIER], 1)];
    expect(restorableEaters({ card: roast, cards: now, presentIds: ALL })).toEqual([OLIVIER, TIMOTHE]);
  });

  it("un dessert : tous ses présents reviennent, même s'ils ont un plat", () => {
    const flan = dish("flan", "dessert", 1, ALL);
    const now = [dish("pates", "main", 0, ALL)];
    expect(restorableEaters({ card: flan, cards: now, presentIds: ALL })).toEqual(ALL);
  });

  it("personne : rien ne revient", () => {
    const now = [dish("pates", "main", 0, ALL)];
    expect(restorableEaters({ card: roast, cards: now, presentIds: ALL })).toEqual([]);
    expect(restorableEaters({ card: roast, cards: [], presentIds: [] })).toEqual([]);
  });
});

// ─── Les repas d'une semaine ────────────────────────────────────────────────
describe("buildBoard : repas d'une semaine", () => {
  it("un repas retiré disparaît, un repas ajouté apparaît, avec sa ligne", () => {
    const home = SLOTS.filter((slot) => slot.meal_type !== "midi" && slot.meal_type !== "pique_nique");
    const slots = weekSlots(home, [
      { day: 6, meal_type: "soir", member_ids: [] },
      { day: 5, meal_type: "midi", member_ids: ALL },
    ]);
    const board = buildBoard(slots, []);
    expect(board.map((row) => row.row)).toEqual(["petit_dej", "midi", "soir"]);
    expect(board[1].days[5].slots.map((slot) => slot.meal_type)).toEqual(["midi"]);
    expect(board[1].days[0].slots).toEqual([]);
    expect(board[2].days[6].slots).toEqual([]);
  });
});

describe("trimCards", () => {
  const cards = [
    dish("roti", "main", 0, [OLIVIER, TIMOTHE, ANNA, OTIS]),
    dish("ceto", "main", 1, [ML]),
    dish("yaourt", "dairy", 2, ALL),
    dish("mardi", "main", 0, ALL, 1),
  ];

  it("retire les absents des plats et des desserts du repas, supprime les cartes vides", () => {
    const trimmed = trimCards(cards, 0, "soir", [OLIVIER, TIMOTHE, ANNA, OTIS]);
    expect(trimmed.map((card) => card.id)).toEqual(["roti", "yaourt", "mardi"]);
    expect(trimmed.find((card) => card.id === "yaourt")?.member_ids).toEqual([OLIVIER, TIMOTHE, ANNA, OTIS]);
    expect(trimmed.find((card) => card.id === "mardi")?.member_ids).toEqual(ALL);
  });

  it("personne : toutes les cartes du repas partent", () => {
    expect(trimCards(cards, 0, "soir", []).map((card) => card.id)).toEqual(["mardi"]);
  });
});

describe("leavingNote", () => {
  const FAMILY = [
    { id: OLIVIER, first_name: "Olivier" },
    { id: ML, first_name: "Marie-Laure" },
    { id: TIMOTHE, first_name: "Timothé" },
    { id: ANNA, first_name: "Anna-Lucia" },
    { id: OTIS, first_name: "Otis" },
  ];
  const note = (cards: ReturnType<typeof dish>[], present: string[]) => leavingNote(cards, 0, "soir", present, FAMILY);
  const duo = [dish("roti", "main", 0, [OLIVIER, TIMOTHE, ANNA, OTIS]), dish("ceto", "main", 1, [ML])];

  it("seule sur son plat : il sera retiré", () => {
    expect(note(duo, [OLIVIER, TIMOTHE, ANNA, OTIS])).toBe("Le plat de Marie-Laure sera retiré.");
  });

  it("le plat reste pour les autres : elle le quitte", () => {
    expect(note([dish("roti", "main", 0, ALL)], [OLIVIER, TIMOTHE, ANNA, OTIS])).toBe("Marie-Laure quittera son plat.");
  });

  it("plusieurs à quitter, dans l'ordre du foyer", () => {
    expect(note([dish("roti", "main", 0, ALL)], [TIMOTHE, ANNA, OTIS])).toBe("Olivier et Marie-Laure quitteront leur plat.");
  });

  it("plusieurs plats retirés, « d' » devant une voyelle", () => {
    const kids = [dish("roti", "main", 0, [OLIVIER, ML, TIMOTHE]), dish("pates", "main", 1, [OTIS]), dish("riz", "main", 2, [ANNA])];
    expect(note(kids, [OLIVIER, ML, TIMOTHE])).toBe("Les plats d’Anna-Lucia et Otis seront retirés.");
    expect(note([dish("pates", "main", 0, [OTIS]), dish("roti", "main", 1, [OLIVIER])], [OLIVIER])).toBe("Le plat d’Otis sera retiré.");
  });

  it("les deux phrases ensemble ; les desserts ne comptent pas ; personne : rien à dire", () => {
    expect(note([...duo, dish("yaourt", "dairy", 2, ALL)], [TIMOTHE, ANNA, OTIS])).toBe(
      "Olivier quittera son plat. Le plat de Marie-Laure sera retiré.",
    );
    expect(note([dish("yaourt", "dairy", 2, ALL)], [OLIVIER])).toBeNull();
    expect(note(duo, ALL)).toBeNull();
  });
});

describe("clearableCards", () => {
  it("retire les plats non verrouillés, garde les plats verrouillés et les à-côtés", () => {
    const cards = [
      { id: "a", locked: false, course: "main" as Course },
      { id: "b", locked: true, course: "main" as Course },
      { id: "c", locked: false, course: "dessert" as Course },
      { id: "d", locked: false },
      { id: "e", locked: false, course: "starter" as Course },
      { id: "f", locked: false, course: "fruit" as Course },
      { id: "g", locked: false, course: "cheese" as Course },
      { id: "h", locked: false, course: "dairy" as Course },
    ];
    expect(clearableCards(cards).map((card) => card.id)).toEqual(["a", "d"]);
  });

  it("ne retire rien d'une semaine vide", () => {
    expect(clearableCards([])).toEqual([]);
  });
});
