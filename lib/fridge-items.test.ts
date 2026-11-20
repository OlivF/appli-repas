import { describe, expect, it } from "vitest";
import type { FridgeItem } from "./fridge";
import {
  bestBeforeLabel,
  dateForPreset,
  dayDate,
  findIngredient,
  formatFridgeQuantity,
  fridgeSections,
  ingredientKey,
  isUrgent,
  parseFridgeInput,
  parseQuantity,
  presetFor,
  quantityStep,
  settlementText,
  shortDate,
  type FridgeIngredient,
} from "./fridge-items";

// Jeudi 19 novembre 2026.
const TODAY = "2026-11-19";

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

function ingredient(id: string, name: string, fields: Partial<FridgeIngredient> = {}): FridgeIngredient {
  return {
    id,
    name,
    name_key: ingredientKey(name),
    aliases: [],
    aisle: "epicerie",
    shopping_unit: "g",
    shelf_life_days: null,
    ...fields,
  };
}

describe("ingredientKey", () => {
  it("normalise comme la base : minuscules, sans accents, pluriel simple retiré", () => {
    expect(ingredientKey("  Œufs ")).toBe("oeuf");
    expect(ingredientKey("Pommes de terre")).toBe("pomme de terre");
    expect(ingredientKey("Riz")).toBe("riz");
    expect(ingredientKey("Gousses d’ail")).toBe("gousse d'ail");
    expect(ingredientKey("Crème fraîche")).toBe("creme fraiche");
  });
});

describe("findIngredient", () => {
  const ingredients = [
    ingredient("creme", "Crème fraîche épaisse", { aliases: [ingredientKey("crème fraîche")] }),
    ingredient("oeufs", "Œufs", { shopping_unit: "piece" }),
  ];

  it("trouve par nom ou par alias, sans accents ni pluriel", () => {
    expect(findIngredient("oeuf", ingredients)?.id).toBe("oeufs");
    expect(findIngredient("creme fraiche", ingredients)?.id).toBe("creme");
    expect(findIngredient("Crème fraîche épaisse", ingredients)?.id).toBe("creme");
  });

  it("rien pour un texte libre", () => {
    expect(findIngredient("Reste de lasagnes", ingredients)).toBeNull();
    expect(findIngredient("  ", ingredients)).toBeNull();
  });
});

describe("quantités", () => {
  it("lit un nombre à la française, vide = inconnue", () => {
    expect(parseQuantity("200")).toEqual({ ok: true, quantity: 200 });
    expect(parseQuantity(" 1,5 ")).toEqual({ ok: true, quantity: 1.5 });
    expect(parseQuantity("")).toEqual({ ok: true, quantity: null });
    expect(parseQuantity("beaucoup")).toEqual({ ok: false, error: "Indique un nombre, par exemple 200." });
    expect(parseQuantity("0")).toEqual({ ok: false, error: "Indique un nombre, par exemple 200." });
  });

  it("le pas des boutons − / + : 50 g, 50 ml, 1 pièce, 1 part", () => {
    expect(quantityStep("g")).toBe(50);
    expect(quantityStep("ml")).toBe(50);
    expect(quantityStep("piece")).toBe(1);
    expect(quantityStep(null)).toBe(1);
  });

  it("« 200 g », « 1,2 kg », « 3 », « 2 parts », rien", () => {
    expect(formatFridgeQuantity(fridge("a", { quantity: 200, unit: "g" }))).toBe("200 g");
    expect(formatFridgeQuantity(fridge("a", { quantity: 1200, unit: "g" }))).toBe("1,2 kg");
    expect(formatFridgeQuantity(fridge("a", { quantity: 3, unit: "piece" }))).toBe("3");
    expect(formatFridgeQuantity(fridge("a", { quantity: 2, origin: "leftover", recipe_id: "r" }))).toBe("2 parts");
    expect(formatFridgeQuantity(fridge("a", { quantity: 1, origin: "leftover", recipe_id: "r" }))).toBe("1 part");
    expect(formatFridgeQuantity(fridge("a", { quantity: 3 }))).toBe("3");
    expect(formatFridgeQuantity(fridge("a"))).toBe("");
  });
});

describe("dates", () => {
  it("« jeu. 26 », le mois quand il change, « 1er »", () => {
    expect(dayDate("2026-11-26", TODAY)).toBe("jeu. 26");
    expect(dayDate("2026-12-01", TODAY)).toBe("mar. 1er déc.");
    expect(shortDate("2026-11-16")).toBe("16 nov.");
    expect(shortDate("2026-12-01")).toBe("1er déc.");
  });

  it("dit ce qu'il faut finir vite", () => {
    expect(bestBeforeLabel("2026-11-18", TODAY)).toEqual({ text: "Périmé hier ?", tone: "expired" });
    expect(bestBeforeLabel("2026-11-16", TODAY)).toEqual({ text: "Périmé depuis 3 jours ?", tone: "expired" });
    expect(bestBeforeLabel("2026-11-19", TODAY)).toEqual({ text: "Aujourd’hui", tone: "soon" });
    expect(bestBeforeLabel("2026-11-20", TODAY)).toEqual({ text: "Demain", tone: "soon" });
    expect(bestBeforeLabel("2026-11-21", TODAY)).toEqual({ text: "Après-demain", tone: "soon" });
    expect(bestBeforeLabel("2026-11-26", TODAY)).toEqual({ text: "jusqu’au jeu. 26", tone: "ok" });
    expect(bestBeforeLabel(null, TODAY)).toBeNull();
  });

  it("puces de date : préréglage, date choisie, pas de date", () => {
    expect(presetFor("2026-11-19", TODAY)).toBe("today");
    expect(presetFor("2026-11-20", TODAY)).toBe("tomorrow");
    expect(presetFor("2026-11-22", TODAY)).toBe("3days");
    expect(presetFor("2026-11-26", TODAY)).toBe("week");
    expect(presetFor("2026-12-10", TODAY)).toBe("custom");
    expect(presetFor("2026-11-17", TODAY)).toBe("custom");
    expect(presetFor(null, TODAY)).toBe("none");
    expect(dateForPreset("3days", null, TODAY)).toBe("2026-11-22");
    expect(dateForPreset("week", null, TODAY)).toBe("2026-11-26");
    expect(dateForPreset("custom", "2026-12-10", TODAY)).toBe("2026-12-10");
    expect(dateForPreset("custom", "", TODAY)).toBeNull();
    expect(dateForPreset("none", "2026-12-10", TODAY)).toBeNull();
  });
});

describe("fridgeSections", () => {
  // Liste de la semaine du 23 novembre (finit le dimanche 29).
  const listWeeks = { "liste-23": "2026-11-23" };
  const aisles = { creme: "cremerie", poulet: "boucherie", carottes: "fruits_legumes" } as const;
  const items = [
    fridge("carottes", { ingredient_id: "carottes", label: "Carottes", quantity: 6, unit: "piece", best_before: "2026-12-10" }),
    fridge("creme", { ingredient_id: "creme", label: "Crème fraîche épaisse", quantity: 200, unit: "g", best_before: "2026-11-20" }),
    fridge("lasagnes", { label: "Reste : Lasagnes", quantity: 2, origin: "leftover", recipe_id: "r", best_before: "2026-11-22" }),
    fridge("poulet-perime", { ingredient_id: "poulet", label: "Blancs de poulet", quantity: 300, unit: "g", best_before: "2026-11-18" }),
    fridge("bougie", { label: "Bougies" }),
    fridge("steaks", {
      ingredient_id: "poulet",
      label: "Blancs de poulet",
      quantity: 400,
      unit: "g",
      best_before: "2026-11-21",
      origin: "shopping",
      reserved_list_id: "liste-23",
    }),
    fridge("creme-menu", {
      ingredient_id: "creme",
      label: "Crème fraîche épaisse",
      quantity: 250,
      unit: "g",
      best_before: "2026-11-26",
      origin: "shopping",
      reserved_list_id: "liste-23",
    }),
  ];
  const sections = fridgeSections(items, { listWeeks, aisles, today: TODAY });

  it("« À finir vite » : périmés puis bientôt, réservés compris s'ils périment avant la fin de leur semaine", () => {
    expect(sections.urgent.map((item) => item.id)).toEqual(["poulet-perime", "creme", "steaks"]);
  });

  it("« Restes » : les plats d'abord, puis par rayon dans l'ordre du drive ; texte libre en « Autre »", () => {
    expect(sections.leftovers.map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ["Plats", ["lasagnes"]],
      ["Fruits et légumes", ["carottes"]],
      ["Autre", ["bougie"]],
    ]);
  });

  it("« Pour le menu de la semaine » : les autres réservés, par semaine", () => {
    expect(sections.reserved.map((group) => [group.weekStart, group.items.map((item) => item.id)])).toEqual([
      ["2026-11-23", ["creme-menu"]],
    ]);
  });

  it("un réservé qui périme après la fin de sa semaine n'est pas urgent", () => {
    const late = fridge("late", { best_before: "2026-11-30", reserved_list_id: "liste-23" });
    expect(isUrgent(late, "2026-11-23", "2026-11-28")).toBe(false);
    expect(isUrgent(late, null, "2026-11-28")).toBe(true);
  });
});

describe("settlementText", () => {
  it("résume le bilan d'une semaine", () => {
    expect(settlementText("2026-11-16", 6)).toBe(
      "Semaine du 16 nov. terminée : on a retiré ce qui a été cuisiné. Il te reste 6 articles.",
    );
    expect(settlementText("2026-11-16", 1)).toBe("Semaine du 16 nov. terminée : on a retiré ce qui a été cuisiné. Il te reste 1 article.");
    expect(settlementText("2026-11-16", 0)).toBe("Semaine du 16 nov. terminée : on a retiré ce qui a été cuisiné. Le frigo est vide.");
  });
});

describe("parseFridgeInput", () => {
  it("un nom, une quantité facultative, une date facultative", () => {
    expect(parseFridgeInput({ label: "  Reste  de lasagnes ", quantity: "2", bestBefore: "2026-11-22" })).toEqual({
      ok: true,
      label: "Reste de lasagnes",
      quantity: 2,
      bestBefore: "2026-11-22",
    });
    expect(parseFridgeInput({ label: "Crème", quantity: "", bestBefore: null })).toEqual({
      ok: true,
      label: "Crème",
      quantity: null,
      bestBefore: null,
    });
  });

  it("refuse un nom vide ou trop long, une quantité ou une date illisibles", () => {
    expect(parseFridgeInput({ label: " ", quantity: "", bestBefore: null })).toEqual({ ok: false, error: "Écris ce que tu ranges." });
    expect(parseFridgeInput({ label: "x".repeat(81), quantity: "", bestBefore: null })).toEqual({
      ok: false,
      error: "Ce nom est trop long (80 caractères au plus).",
    });
    expect(parseFridgeInput({ label: "Crème", quantity: "beaucoup", bestBefore: null })).toEqual({
      ok: false,
      error: "Indique un nombre, par exemple 200.",
    });
    expect(parseFridgeInput({ label: "Crème", quantity: "", bestBefore: "2026-02-30" })).toEqual({ ok: false, error: "Choisis une date." });
  });
});
