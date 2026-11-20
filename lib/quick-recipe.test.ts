import { describe, expect, it } from "vitest";
import { guessCourse, guessDiets, quickRecipe } from "./quick-recipe";

describe("guessCourse", () => {
  it("devine la sorte par le rayon de l'ingrédient : fruits et légumes → Fruit, crèmerie → Laitage", () => {
    expect(guessCourse("fruits_legumes")).toBe("fruit");
    expect(guessCourse("cremerie")).toBe("dairy");
    expect(guessCourse("epicerie")).toBeNull();
    expect(guessCourse(null)).toBeNull();
  });
});

describe("guessDiets", () => {
  const catalog = [{ course: "cheese" as const, servings: 1, ingredientNames: ["Comté"], diets: ["vegetarian", "gluten_free", "lactose_free", "keto"] as const }];

  it("reprend les régimes d'une recette légère du catalogue au même ingrédient", () => {
    expect(guessDiets("cheese", "comte", catalog)).toEqual(["vegetarian", "gluten_free", "lactose_free", "keto"]);
  });

  it("sinon : fruit → végétarien, sans gluten, sans lactose ; laitage → végétarien, sans gluten ; fromage → + céto", () => {
    expect(guessDiets("fruit", "Kaki", catalog)).toEqual(["vegetarian", "gluten_free", "lactose_free"]);
    expect(guessDiets("dairy", "Skyr", catalog)).toEqual(["vegetarian", "gluten_free"]);
    expect(guessDiets("cheese", "Morbier", catalog)).toEqual(["vegetarian", "gluten_free", "keto"]);
  });

  it("rien pour un dessert ou une entrée créés avec leur titre seulement", () => {
    expect(guessDiets("dessert", "Clafoutis", catalog)).toEqual([]);
    expect(guessDiets("starter", "Taboulé", catalog)).toEqual([]);
  });
});

describe("quickRecipe", () => {
  it("un fruit : un ingrédient pour une personne, tous les repas", () => {
    const result = quickRecipe({
      title: " Kaki ",
      course: "fruit",
      quantity: "1",
      unit: "piece",
      ingredient: "",
      aisle: "fruits_legumes",
      diets: ["vegetarian", "gluten_free", "lactose_free"],
    });
    expect(result).toEqual({
      ok: true,
      recipe: expect.objectContaining({
        title: "Kaki",
        course: "fruit",
        servings: 1,
        meal_types: ["petit_dej", "midi", "pique_nique", "soir"],
        diets: ["vegetarian", "gluten_free", "lactose_free"],
        steps: [],
        base: null,
        basic: false,
      }),
      ingredients: [{ name: "Kaki", quantity: 1, unit: "piece", aisle: "fruits_legumes" }],
    });
  });

  it("une portion en grammes, à la virgule", () => {
    const result = quickRecipe({ title: "Morbier", course: "cheese", quantity: "30,5", unit: "g", ingredient: "Morbier", aisle: "cremerie", diets: [] });
    expect(result.ok && result.ingredients).toEqual([{ name: "Morbier", quantity: 30.5, unit: "g", aisle: "cremerie" }]);
  });

  it("un dessert : le titre seulement, pour 4, sans ingrédient", () => {
    const result = quickRecipe({ title: "Clafoutis", course: "dessert", diets: [] });
    expect(result.ok && result.recipe).toMatchObject({ title: "Clafoutis", course: "dessert", servings: 4, diets: [] });
    expect(result.ok && result.ingredients).toEqual([]);
  });

  it("refuse un titre vide, une portion illisible, ou un plat", () => {
    expect(quickRecipe({ title: "  ", course: "fruit", quantity: "1", unit: "piece", diets: [] })).toEqual({ ok: false, error: "Donne un nom." });
    expect(quickRecipe({ title: "Kaki", course: "fruit", quantity: "beaucoup", unit: "piece", diets: [] })).toEqual({
      ok: false,
      error: "Indique une portion en chiffres, par exemple 1 ou 30.",
    });
    expect(quickRecipe({ title: "Gratin", course: "main", diets: [] }).ok).toBe(false);
  });

  it("tient bon face à des valeurs mal typées venues du navigateur", () => {
    const result = quickRecipe({ title: "Kaki", course: "fruit", quantity: 2 as unknown as string, ingredient: null as unknown as string, diets: [] });
    expect(result.ok && result.ingredients).toEqual([{ name: "Kaki", quantity: 2, unit: "piece", aisle: "fruits_legumes" }]);
  });
});
