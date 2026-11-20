import { describe, expect, it } from "vitest";
import type { StoredItem } from "./shopping";
import {
  defaultShoppingWeek,
  fridgeNote,
  fridgeSourceLine,
  parseManualItem,
  preStored,
  storeCandidates,
  storeProposalVisible,
  storedQuantity,
  urgentStripText,
} from "./shopping-items";

describe("parseManualItem", () => {
  it("garde le nom rogné et une quantité libre facultative", () => {
    expect(parseManualItem("  Papier   toilette ", " 2 paquets ")).toEqual({
      ok: true,
      label: "Papier toilette",
      quantityText: "2 paquets",
    });
    expect(parseManualItem("Café", "   ")).toEqual({ ok: true, label: "Café", quantityText: null });
  });

  it("refuse un nom vide", () => {
    expect(parseManualItem("   ", "2")).toEqual({ ok: false, error: "Écris le nom de l'article." });
  });

  it("refuse un nom ou une quantité trop longs", () => {
    expect(parseManualItem("a".repeat(81), "")).toEqual({
      ok: false,
      error: "Ce nom est trop long (80 caractères au plus).",
    });
    expect(parseManualItem("Café", "1".repeat(41))).toEqual({
      ok: false,
      error: "Cette quantité est trop longue (40 caractères au plus).",
    });
  });
});

describe("defaultShoppingWeek", () => {
  // Jeudi 19 novembre 2026 : semaine en cours du 16, semaine prochaine du 23.
  const today = "2026-11-19";

  it("la semaine prochaine si elle a un menu", async () => {
    expect(await defaultShoppingWeek(today, async (week) => week === "2026-11-23")).toBe("2026-11-23");
  });

  it("sinon la semaine en cours", async () => {
    expect(await defaultShoppingWeek(today, async () => false)).toBe("2026-11-16");
  });
});

function stored(fields: Partial<StoredItem> & Pick<StoredItem, "label">): StoredItem {
  return {
    ingredient_id: null,
    amounts: [],
    aisle: "autre",
    pantry: false,
    sources: [],
    checked: false,
    removed: false,
    needed: false,
    quantity_changed: false,
    manual: false,
    quantity_text: null,
    position: 0,
    from_fridge: 0,
    maybe_in_fridge: false,
    stored: false,
    ...fields,
  };
}

const creme = (fields: Partial<StoredItem> = {}) =>
  stored({ ingredient_id: "creme", label: "Crème fraîche épaisse", aisle: "cremerie", ...fields });

describe("fridgeNote", () => {
  it("en partie au frigo : « + 200 g au frigo » sous la quantité à acheter", () => {
    expect(fridgeNote(creme({ amounts: [{ quantity: 150, unit: "g" }], from_fridge: 200 }), "g")).toBe("+ 200 g au frigo");
  });

  it("entièrement au frigo : « 350 g au frigo »", () => {
    expect(fridgeNote(creme({ from_fridge: 350 }), "g")).toBe("350 g au frigo");
    expect(fridgeNote(creme({ from_fridge: 1200 }), "g")).toBe("1,2 kg au frigo");
    expect(fridgeNote(stored({ ingredient_id: "steak", label: "Steaks", from_fridge: 4.9 }), "piece")).toBe("4,9 au frigo");
  });

  it("au frigo sans quantité connue, ou rien", () => {
    expect(fridgeNote(creme({ amounts: [{ quantity: 350, unit: "g" }], maybe_in_fridge: true }), "g")).toBe(
      "Tu en as peut-être au frigo",
    );
    expect(fridgeNote(creme({ amounts: [{ quantity: 350, unit: "g" }] }), "g")).toBeNull();
  });
});

describe("fridgeSourceLine", () => {
  it("« Au frigo : 200 g, jusqu'au mar. 24 », ou sans date", () => {
    expect(fridgeSourceLine(creme({ from_fridge: 200 }), "g", "2026-11-24", "2026-11-19")).toBe("Au frigo : 200 g, jusqu’au mar. 24");
    expect(fridgeSourceLine(creme({ from_fridge: 200 }), "g", null, "2026-11-19")).toBe("Au frigo : 200 g");
    expect(fridgeSourceLine(creme(), "g", "2026-11-24", "2026-11-19")).toBeNull();
  });
});

describe("storedQuantity", () => {
  it("la quantité achetée, dans l'unité d'achat", () => {
    expect(storedQuantity(creme({ amounts: [{ quantity: 250, unit: "g" }, { quantity: 2, unit: "cas" }] }), "g")).toBe(250);
    expect(storedQuantity(creme(), "g")).toBeNull();
  });

  it("un article ajouté à la main : lu si l'unité colle, sinon inconnue", () => {
    const manual = (quantity_text: string) => stored({ label: "Œufs", ingredient_id: "oeufs", manual: true, quantity_text });
    expect(storedQuantity(manual("6"), "piece")).toBe(6);
    expect(storedQuantity(manual("500 g"), "piece")).toBeNull();
    expect(storedQuantity(manual("1 kg"), "g")).toBe(1000);
    expect(storedQuantity(manual("1,5 l"), "ml")).toBe(1500);
    expect(storedQuantity(manual("500"), "g")).toBeNull();
    expect(storedQuantity(manual("1 paquet"), "piece")).toBeNull();
    expect(storedQuantity(stored({ label: "Bougies", manual: true, quantity_text: "2" }), null)).toBeNull();
  });
});

describe("ranger les courses", () => {
  const items = [
    creme({ checked: true, amounts: [{ quantity: 150, unit: "g" }] }),
    stored({ label: "Huile d'olive", ingredient_id: "huile", pantry: true, needed: true, checked: true }),
    stored({ label: "Jus d'orange", ingredient_id: "jus", aisle: "boissons", checked: true }),
    stored({ label: "Bougies", manual: true, checked: true }),
    stored({ label: "Œufs", ingredient_id: "oeufs", aisle: "cremerie", checked: true, stored: true }),
    stored({ label: "Lait", ingredient_id: "lait", aisle: "cremerie", checked: false }),
    stored({ label: "Beurre", ingredient_id: "beurre", aisle: "cremerie", from_fridge: 250 }),
  ];

  it("propose les articles cochés et pas encore rangés", () => {
    expect(storeCandidates(items).map((item) => item.label)).toEqual(["Crème fraîche épaisse", "Huile d'olive", "Jus d'orange", "Bougies"]);
  });

  it("pré-coche ceux qui ont un ingrédient, hors placard, boissons et « Autre »", () => {
    expect(storeCandidates(items).filter(preStored).map((item) => item.label)).toEqual(["Crème fraîche épaisse"]);
  });

  const list = { stored_at: null, settled_at: null };
  const allChecked = items.map((item) => ({ ...item, checked: true }));

  it("la carte : tout est coché, ou dès le jeudi qui précède la semaine avec au moins un coché", () => {
    expect(storeProposalVisible({ items: allChecked, list, weekStart: "2026-11-30", today: "2026-11-19" })).toBe(true);
    expect(storeProposalVisible({ items, list, weekStart: "2026-11-23", today: "2026-11-19" })).toBe(true);
    expect(storeProposalVisible({ items, list, weekStart: "2026-11-23", today: "2026-11-18" })).toBe(false);
  });

  it("jamais une fois traitée, la semaine soldée, ou sans rien à ranger", () => {
    const now = "2026-11-19T10:00:00Z";
    expect(storeProposalVisible({ items: allChecked, list: { stored_at: now, settled_at: null }, weekStart: "2026-11-23", today: "2026-11-19" })).toBe(false);
    expect(storeProposalVisible({ items: allChecked, list: { stored_at: null, settled_at: now }, weekStart: "2026-11-23", today: "2026-11-19" })).toBe(false);
    const nothing = items.map((item) => ({ ...item, stored: item.checked }));
    expect(storeProposalVisible({ items: nothing, list, weekStart: "2026-11-23", today: "2026-11-19" })).toBe(false);
  });
});

describe("urgentStripText", () => {
  it("trois noms au plus, en minuscules, puis « et N autres »", () => {
    expect(urgentStripText(["Blancs de poulet", "Crème fraîche épaisse", "Courgettes"])).toBe(
      "À finir : blancs de poulet, crème fraîche épaisse, courgettes",
    );
    expect(urgentStripText(["Blancs de poulet", "Reste : Lasagnes", "Courgettes", "Lait", "Œufs"])).toBe(
      "À finir : blancs de poulet, lasagnes, courgettes et 2 autres",
    );
    expect(urgentStripText(["Lait", "Œufs", "Beurre", "Crème"])).toBe("À finir : lait, œufs, beurre et 1 autre");
    expect(urgentStripText([])).toBeNull();
  });
});
