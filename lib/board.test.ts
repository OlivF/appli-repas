import { describe, expect, it } from "vitest";
import { buildBoard } from "@/lib/board";
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
