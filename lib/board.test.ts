import { describe, expect, it } from "vitest";
import { buildBoard, menuBase, moveEaters } from "@/lib/board";
import type { SlotInput } from "@/lib/meal-slots";
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
