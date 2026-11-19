import { describe, expect, it, vi } from "vitest";
import { loadFridgeForMenu } from "./fridge-data";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

// Un client Supabase réduit à ce que lit loadFridgeForMenu : from().select().eq().
function fakeClient(rows: Record<string, unknown>[]) {
  const calls: unknown[][] = [];
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      return {
        select(columns: string) {
          calls.push(["select", columns]);
          return {
            eq(column: string, value: string) {
              calls.push(["eq", column, value]);
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

const row = (fields: Record<string, unknown>) => ({
  ingredient_id: null,
  quantity: null,
  unit: null,
  best_before: null,
  origin: "manual",
  recipe_id: null,
  reserved_list_id: null,
  ...fields,
});

describe("loadFridgeForMenu", () => {
  it("rend le frigo du foyer, trié par urgence, sous la forme du contrat pour le menu IA", async () => {
    const { client, calls } = fakeClient([
      row({ id: "c1", ingredient_id: "creme", label: "Crème fraîche épaisse", quantity: 200, unit: "g", best_before: "2026-11-30" }),
      row({ id: "p1", ingredient_id: "poulet", label: "Blancs de poulet", quantity: "300", unit: "g", best_before: "2026-11-17" }),
    ]);

    const entries = await loadFridgeForMenu("foyer-1", { supabase: client as never, today: "2026-11-19" });

    expect(calls).toContainEqual(["from", "fridge_items"]);
    expect(calls).toContainEqual(["eq", "household_id", "foyer-1"]);
    expect(entries.map((entry) => entry.name)).toEqual(["Blancs de poulet", "Crème fraîche épaisse"]);
    expect(entries[0]).toEqual({
      ingredientId: "poulet",
      recipeId: null,
      name: "Blancs de poulet",
      quantity: 300,
      unit: "g",
      bestBefore: "2026-11-17",
      daysLeft: -2,
      status: "expired",
      reserved: false,
    });
  });
});
