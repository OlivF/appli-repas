import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/lib/recipes";
import { loadWeek, weekCards, type WeekCard } from "@/lib/week-data";
import { clearWeekAction } from "./actions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/week-data", () => ({ loadWeek: vi.fn(), weekCards: vi.fn() }));

type Row = { id: string; locked: boolean; course: Course };

const card = ({ id, locked, course }: Row): WeekCard => ({
  id,
  day: 0,
  meal_type: "soir",
  position: 0,
  recipe_id: `r-${id}`,
  member_ids: ["paul"],
  locked,
  course,
});

// La table planned_meals réduite à ce que fait clearWeekAction : delete().in().eq().select(), ou
// delete().in() attendu tel quel. Les lignes supprimées le sont pour de bon.
function fakeDb(rows: Row[]) {
  const table = [...rows];
  const run = (filters: ((row: Row) => boolean)[]) => {
    const gone = table.filter((row) => filters.every((keep) => keep(row)));
    for (const row of gone) table.splice(table.indexOf(row), 1);
    return gone;
  };
  const client = {
    from(name: string) {
      expect(name).toBe("planned_meals");
      return {
        delete() {
          const filters: ((row: Row) => boolean)[] = [];
          const query = {
            in(column: keyof Row, values: unknown[]) {
              filters.push((row) => values.includes(row[column]));
              return query;
            },
            eq(column: keyof Row, value: unknown) {
              filters.push((row) => row[column] === value);
              return query;
            },
            select() {
              return Promise.resolve({ data: run(filters).map(({ id }) => ({ id })), error: null });
            },
            then(resolve: (value: { data: null; error: null }) => void) {
              run(filters);
              resolve({ data: null, error: null });
            },
          };
          return query;
        },
      };
    },
  };
  return { client, table };
}

const WEEK = "2026-11-30";

describe("clearWeekAction", () => {
  beforeEach(() => {
    vi.mocked(loadWeek).mockReset();
    vi.mocked(weekCards).mockReset();
  });

  // L'écran a lu la semaine avec « Gratin » libre ; l'autre compte l'a verrouillé juste avant
  // la suppression.
  function lockedMeanwhile() {
    const read: Row[] = [
      { id: "pates", locked: false, course: "main" },
      { id: "gratin", locked: false, course: "main" },
      { id: "yaourt", locked: false, course: "dairy" },
    ];
    const { client, table } = fakeDb([read[0], { ...read[1], locked: true }, read[2]]);
    vi.mocked(loadWeek).mockResolvedValue({ supabase: client, plan: { id: "plan-1", seed: 0 }, cards: read.map(card) } as never);
    vi.mocked(weekCards).mockImplementation(async () => table.map(card));
    return table;
  }

  it("garde un plat verrouillé entre-temps par un autre compte", async () => {
    const table = lockedMeanwhile();
    const result = await clearWeekAction(WEEK);
    expect(table.map((row) => row.id)).toEqual(["gratin", "yaourt"]);
    expect(result).toMatchObject({ cards: [{ id: "gratin" }, { id: "yaourt" }] });
  });

  it("rend le nombre de plats vraiment retirés", async () => {
    lockedMeanwhile();
    const result = await clearWeekAction(WEEK);
    expect(result).toMatchObject({ removed: 1 });
  });

  it("une semaine sans plan : rien à retirer", async () => {
    vi.mocked(loadWeek).mockResolvedValue({ supabase: fakeDb([]).client, plan: null, cards: [] } as never);
    expect(await clearWeekAction(WEEK)).toEqual({ cards: [], removed: 0 });
  });
});
