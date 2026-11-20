import { describe, expect, it } from "vitest";
import { catalogueSql, recipeId, type JsonRecipe } from "./json-to-catalogue";

const steakFrites: JsonRecipe = {
  titre: "Steak haché et frites",
  description: "Le basique qui plaît à tout le monde.",
  base: "Steak haché",
  accompagnement: "Frites",
  types: ["midi", "soir"],
  portions: 4,
  prep: 3,
  cuisson: 25,
  regimes: ["sans_lactose"],
  batch: false,
  batch_notes: null,
  kid_friendly: true,
  basique: true,
  ingredients: [
    ["Steaks hachés pur bœuf", 4, "piece", "boucherie"],
    ["Huile d'olive", 1, "cas", "epicerie"],
    ["Sel, poivre", null, null, "epicerie"],
  ],
  etapes: ["Cuis les frites.", "Cuis les steaks."],
};

describe("recipeId", () => {
  it("est un UUID v5 stable, dérivé du titre", () => {
    expect(recipeId("Steak haché et frites")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(recipeId("Steak haché et frites")).toBe(recipeId("Steak haché et frites"));
    expect(recipeId("Steak haché et frites")).not.toBe(recipeId("Steak haché et purée"));
  });

  it("ne dépend ni des majuscules, ni des accents, ni des espaces autour", () => {
    expect(recipeId("  STEAK HACHE ET FRITES ")).toBe(recipeId("Steak haché et frites"));
  });
});

describe("catalogueSql", () => {
  const sql = catalogueSql({ recettes: [steakFrites] }, "recettes-basiques.json");

  it("insère la recette au catalogue, une seule fois même rejouée", () => {
    expect(sql).toContain(`'${recipeId("Steak haché et frites")}'`);
    expect(sql).toContain("on conflict (id) do nothing");
    expect(sql).toMatch(/household_id[^;]*null/);
  });

  it("écrit la base et le drapeau basique, pas l'accompagnement", () => {
    expect(sql).toContain("'Steak haché'");
    expect(sql).toMatch(/\btrue\b/);
    expect(sql).not.toContain("'Frites'");
  });

  it("traduit les régimes et les types de repas", () => {
    expect(sql).toContain("array['lactose_free']::public.diet[]");
    expect(sql).toContain("array['midi', 'soir']::public.meal_type[]");
  });

  it("échappe les apostrophes et garde « sel, poivre » sans quantité", () => {
    expect(sql).toContain("'Huile d''olive'");
    expect(sql).toMatch(/'Sel, poivre', null::numeric, null::public\.ingredient_unit/);
  });

  it("dit d'où il vient et comment le régénérer", () => {
    expect(sql).toContain("-- Catalogue commun : 1 recette importée de recettes-basiques.json.");
    expect(sql).toContain("scripts/json-to-catalogue.ts recettes-basiques.json");
  });

  it("refuse un régime inconnu en nommant la recette", () => {
    expect(() => catalogueSql({ recettes: [{ ...steakFrites, regimes: ["paleo"] }] }, "x.json")).toThrow(
      /Steak haché et frites.*paleo/,
    );
  });

  it("refuse un rayon inconnu en nommant la recette", () => {
    const bad = { ...steakFrites, ingredients: [["Steak", 1, "piece", "rayon_x"]] } as JsonRecipe;
    expect(() => catalogueSql({ recettes: [bad] }, "x.json")).toThrow(/Steak haché et frites.*rayon_x/);
  });

  it("écrit la sorte d'un plat léger, et « main » quand elle manque", () => {
    const yaourt: JsonRecipe = {
      ...steakFrites,
      titre: "Fromage du jour",
      base: null,
      basique: false,
      plat: "fromage",
      portions: 1,
      ingredients: [["Comté", 30, "g", "cremerie"]],
      etapes: [],
    };
    expect(catalogueSql({ recettes: [yaourt] }, "x.json")).toContain("'cheese'::public.course");
    expect(sql).toContain("'main'::public.course");
  });

  it("refuse une sorte inconnue en nommant la recette", () => {
    expect(() => catalogueSql({ recettes: [{ ...steakFrites, plat: "gouter" }] }, "x.json")).toThrow(
      /Steak haché et frites.*gouter/,
    );
  });

  it("refuse deux recettes de même titre", () => {
    expect(() => catalogueSql({ recettes: [steakFrites, steakFrites] }, "x.json")).toThrow(/en double/);
  });
});
