import { describe, expect, it } from "vitest";
import {
  SOON_DAYS,
  availableStock,
  daysLeft,
  defaultBestBefore,
  fridgeForMenu,
  fridgeSignature,
  fridgeStatus,
  settleWeek,
  type FridgeItem,
  type Reservation,
} from "./fridge";

// Jeudi 19 novembre 2026, jour du drive. L0 : la liste de la semaine en cours (16 nov.),
// L : celle de la semaine prochaine (23 nov.).
const TODAY = "2026-11-19";
const L0 = "liste-16";
const L = "liste-23";

function fridge(id: string, fields: Partial<FridgeItem> = {}): FridgeItem {
  return {
    id,
    ingredient_id: null,
    label: id,
    quantity: null,
    unit: null,
    best_before: null,
    origin: "manual",
    recipe_id: null,
    reserved_list_id: null,
    ...fields,
  };
}

const creme = (id: string, quantity: number | null, fields: Partial<FridgeItem> = {}) =>
  fridge(id, { ingredient_id: "creme", label: "Crème fraîche épaisse", quantity, unit: "g", ...fields });
const oeufs = (id: string, quantity: number | null, fields: Partial<FridgeItem> = {}) =>
  fridge(id, { ingredient_id: "oeufs", label: "Œufs", quantity, unit: "piece", ...fields });

describe("fridgeStatus", () => {
  it("bientôt : aujourd'hui, demain et après-demain", () => {
    expect(SOON_DAYS).toBe(2);
    expect(fridgeStatus({ best_before: "2026-11-19" }, TODAY)).toBe("soon");
    expect(fridgeStatus({ best_before: "2026-11-20" }, TODAY)).toBe("soon");
    expect(fridgeStatus({ best_before: "2026-11-21" }, TODAY)).toBe("soon");
  });

  it("ok à J+3, périmé la veille, rien sans date", () => {
    expect(fridgeStatus({ best_before: "2026-11-22" }, TODAY)).toBe("ok");
    expect(fridgeStatus({ best_before: "2026-11-18" }, TODAY)).toBe("expired");
    expect(fridgeStatus({ best_before: null }, TODAY)).toBe("none");
  });

  it("compte les jours qui restent, négatifs une fois passés", () => {
    expect(daysLeft("2026-11-19", TODAY)).toBe(0);
    expect(daysLeft("2026-11-18", TODAY)).toBe(-1);
    expect(daysLeft("2026-12-01", TODAY)).toBe(12);
  });
});

describe("defaultBestBefore", () => {
  it("aujourd'hui + la durée de conservation de l'ingrédient", () => {
    expect(defaultBestBefore({ shelf_life_days: 7 }, TODAY)).toBe("2026-11-26");
    expect(defaultBestBefore({ shelf_life_days: 90 }, TODAY)).toBe("2027-02-17");
  });

  it("pas de date sans durée connue, ni sans ingrédient", () => {
    expect(defaultBestBefore({ shelf_life_days: null }, TODAY)).toBeNull();
    expect(defaultBestBefore(null, TODAY)).toBeNull();
  });
});

describe("availableStock", () => {
  const items = [creme("c1", 200), creme("c2", 300), creme("c3", 500, { reserved_list_id: L })];
  const reservations: Reservation[] = [{ list_id: L0, ingredient_id: "creme", from_fridge: 100 }];

  it("additionne les articles libres, moins ce que réservent les autres listes", () => {
    expect(availableStock({ items, reservations, listId: L }).stock).toEqual({ creme: 400 });
  });

  it("ignore les réservations de la liste elle-même", () => {
    expect(availableStock({ items, reservations, listId: L0 }).stock).toEqual({ creme: 500 });
  });

  it("n'est jamais négatif", () => {
    const heavy: Reservation[] = [{ list_id: L0, ingredient_id: "creme", from_fridge: 900 }];
    expect(availableStock({ items, reservations: heavy, listId: L }).stock).toEqual({});
  });

  it("met à part les ingrédients présents sans quantité, et ignore les restes de plat", () => {
    const result = availableStock({
      items: [creme("fond", null), fridge("lasagnes", { label: "Reste : Lasagnes", quantity: 2, origin: "leftover" })],
      reservations: [],
      listId: L,
    });
    expect(result.stock).toEqual({});
    expect([...result.maybe]).toEqual(["creme"]);
  });

  it("ignore ce qui périme avant le lundi de la semaine de la liste", () => {
    const items = [
      fridge("poulet", { ingredient_id: "poulet", quantity: 300, unit: "g", best_before: "2026-11-18" }),
      fridge("poulet-2", { ingredient_id: "poulet", quantity: 200, unit: "g", best_before: "2026-11-23" }),
      creme("fond", null, { best_before: "2026-11-21" }),
      oeufs("o1", 6),
    ];
    const next = availableStock({ items, reservations: [], listId: L, weekStart: "2026-11-23" });
    expect(next.stock).toEqual({ poulet: 200, oeufs: 6 });
    expect(next.maybe.size).toBe(0);
    // La semaine en cours : ce qui périme aujourd'hui compte encore.
    const current = availableStock({ items, reservations: [], listId: L0, weekStart: "2026-11-16" });
    expect(current.stock).toEqual({ poulet: 500, oeufs: 6 });
  });

  it("un article réservé n'est ni du stock ni un « peut-être »", () => {
    const result = availableStock({ items: [oeufs("o1", null, { reserved_list_id: L0 })], reservations: [], listId: L });
    expect(result.maybe.size).toBe(0);
  });

  it("ne compte pas deux fois un reste entre deux semaines", () => {
    const eggs = [oeufs("o1", 6)];
    // La semaine en cours a pris 4 œufs : il en reste 2 pour la semaine prochaine…
    const first: Reservation[] = [{ list_id: L0, ingredient_id: "oeufs", from_fridge: 4 }];
    expect(availableStock({ items: eggs, reservations: first, listId: L }).stock).toEqual({ oeufs: 2 });
    // … qui les prend : la semaine en cours, recalculée, garde ses 4.
    const both: Reservation[] = [...first, { list_id: L, ingredient_id: "oeufs", from_fridge: 2 }];
    expect(availableStock({ items: eggs, reservations: both, listId: L0 }).stock).toEqual({ oeufs: 4 });
  });
});

describe("fridgeSignature", () => {
  const stock = (entries: Record<string, number>, maybe: string[] = []) => ({ stock: entries, maybe: new Set(maybe) });

  it("vide quand rien du frigo ne concerne le menu (pas de bandeau sur les listes existantes)", () => {
    expect(fridgeSignature(stock({}), ["creme", "steak"])).toBe("");
    expect(fridgeSignature(stock({ creme: 200 }, ["oeufs"]), ["steak"])).toBe("");
  });

  it("stable, quel que soit l'ordre", () => {
    expect(fridgeSignature(stock({ creme: 200, oeufs: 6 }), ["oeufs", "creme"])).toBe(
      fridgeSignature(stock({ oeufs: 6, creme: 200 }), ["creme", "oeufs"]),
    );
  });

  it("change avec une quantité, ou un ingrédient sans quantité", () => {
    const signature = fridgeSignature(stock({ creme: 200 }), ["creme"]);
    expect(signature).not.toBe("");
    expect(fridgeSignature(stock({ creme: 1200 }), ["creme"])).not.toBe(signature);
    expect(fridgeSignature(stock({}, ["creme"]), ["creme"])).not.toBe("");
  });
});

describe("settleWeek", () => {
  it("consomme les articles réservés à la liste : 6 œufs rangés, 4 cuisinés, il en reste 2", () => {
    expect(settleWeek({ items: [oeufs("o1", 6, { reserved_list_id: L })], listId: L, fromFridge: {}, needs: { oeufs: 4 } })).toEqual([
      { id: "o1", quantity: 2 },
    ]);
  });

  it("puis les restes libres, dans la limite de ce que la liste a pris au frigo", () => {
    const items = [oeufs("o1", 3, { reserved_list_id: L }), oeufs("o2", 6)];
    expect(settleWeek({ items, listId: L, fromFridge: { oeufs: 1 }, needs: { oeufs: 4 } })).toEqual([
      { id: "o1", quantity: null },
      { id: "o2", quantity: 5 },
    ]);
  });

  it("ne touche pas aux restes libres au-delà de la réservation", () => {
    expect(settleWeek({ items: [creme("c1", 500)], listId: L, fromFridge: { creme: 200 }, needs: { creme: 350 } })).toEqual([
      { id: "c1", quantity: 300 },
    ]);
  });

  it("finit d'abord ce qui périme le plus tôt, les articles sans date en dernier", () => {
    const items = [
      oeufs("sans-date", 6, { reserved_list_id: L }),
      oeufs("tard", 6, { reserved_list_id: L, best_before: "2026-11-28" }),
      oeufs("tot", 6, { reserved_list_id: L, best_before: "2026-11-24" }),
    ];
    expect(settleWeek({ items, listId: L, fromFridge: {}, needs: { oeufs: 8 } })).toEqual([
      { id: "tot", quantity: null },
      { id: "tard", quantity: 4 },
    ]);
  });

  it("supprime un reliquat minuscule (< 10 g, < 10 ml, < 0,5 pièce)", () => {
    const items = [
      creme("c1", 200, { reserved_list_id: L }),
      fridge("lait", { ingredient_id: "lait", quantity: 1000, unit: "ml", reserved_list_id: L }),
      fridge("citron", { ingredient_id: "citron", quantity: 1, unit: "piece", reserved_list_id: L }),
    ];
    expect(settleWeek({ items, listId: L, fromFridge: {}, needs: { creme: 191, lait: 991, citron: 0.6 } })).toEqual([
      { id: "c1", quantity: null },
      { id: "lait", quantity: null },
      { id: "citron", quantity: null },
    ]);
    expect(settleWeek({ items, listId: L, fromFridge: {}, needs: { creme: 190 } })).toEqual([{ id: "c1", quantity: 10 }]);
  });

  it("laisse les articles sans quantité, les restes de plat et ceux d'une autre liste", () => {
    const items = [
      creme("fond", null, { reserved_list_id: L }),
      fridge("lasagnes", { label: "Reste : Lasagnes", quantity: 2, origin: "leftover", recipe_id: "lasagnes" }),
      oeufs("o1", 6, { reserved_list_id: L0 }),
    ];
    expect(settleWeek({ items, listId: L, fromFridge: {}, needs: { creme: 100, oeufs: 4 } })).toEqual([]);
  });

  it("un menu vidé ne consomme rien", () => {
    expect(settleWeek({ items: [oeufs("o1", 6, { reserved_list_id: L })], listId: L, fromFridge: { oeufs: 2 }, needs: {} })).toEqual([]);
  });
});

describe("fridgeForMenu", () => {
  const items = [
    creme("ok", 200, { best_before: "2026-11-30" }),
    fridge("sans-date", { label: "Reste : Lasagnes", quantity: 2, origin: "leftover", recipe_id: "lasagnes" }),
    oeufs("demain", 6, { best_before: "2026-11-20", reserved_list_id: L }),
    fridge("perime", { ingredient_id: "poulet", label: "Blancs de poulet", quantity: 300, unit: "g", best_before: "2026-11-17" }),
    fridge("courgettes", { ingredient_id: "courgettes", label: "Courgettes", quantity: 3, unit: "piece", best_before: "2026-11-19" }),
    fridge("champignons", { ingredient_id: "champignons", label: "Champignons de Paris", quantity: 250, unit: "g", best_before: "2026-11-19" }),
  ];

  it("trie par urgence : périmé, bientôt, sans date, ok ; puis par date et par nom", () => {
    expect(fridgeForMenu(items, TODAY).map((entry) => entry.name)).toEqual([
      "Blancs de poulet",
      "Champignons de Paris",
      "Courgettes",
      "Œufs",
      "Reste : Lasagnes",
      "Crème fraîche épaisse",
    ]);
  });

  it("donne une forme stable à chaque article", () => {
    const [first, , , eggs, leftover] = fridgeForMenu(items, TODAY);
    expect(first).toEqual({
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
    expect(eggs).toMatchObject({ status: "soon", daysLeft: 1, reserved: true });
    expect(leftover).toMatchObject({ recipeId: "lasagnes", status: "none", daysLeft: null, unit: null });
  });
});
