import { describe, expect, it } from "vitest";
import type { Diet } from "@/lib/members";
import {
  basicRows,
  recipePartners,
  sameBase,
  sideLabel,
  singularize,
  suggestBase,
  uniqueBases,
} from "./bases";

describe("sameBase", () => {
  it("compare sans accents, majuscules ni espaces autour", () => {
    expect(sameBase("Steak haché", " steak HACHE ")).toBe(true);
    expect(sameBase("Steak", "Steak haché")).toBe(false);
  });

  it("n'associe jamais deux recettes sans base", () => {
    expect(sameBase(null, null)).toBe(false);
    expect(sameBase("", " ")).toBe(false);
  });
});

describe("singularize", () => {
  it.each([
    ["Steaks hachés pur bœuf", "Steak haché pur bœuf"],
    ["Côtes de porc", "Côte de porc"],
    ["Pavés de bœuf", "Pavé de bœuf"],
    ["Cuisses de poulet", "Cuisse de poulet"],
    ["Filets de cabillaud", "Filet de cabillaud"],
    ["Lardons fumés", "Lardon fumé"],
    ["Morceaux de poulet", "Morceau de poulet"],
    ["Moules", "Moule"],
    ["Cuisses d'agneau", "Cuisse d'agneau"],
    ["Saumon", "Saumon"],
    ["Merguez", "Merguez"],
  ])("« %s » → « %s »", (plural, singular) => {
    expect(singularize(plural)).toBe(singular);
  });

  it("laisse les mots invariables", () => {
    expect(singularize("Travers de porc")).toBe("Travers de porc");
    expect(singularize("Noix de Saint-Jacques")).toBe("Noix de Saint-Jacques");
    expect(singularize("Anchois")).toBe("Anchois");
  });
});

describe("suggestBase", () => {
  const known = ["Côte de porc", "Poulet", "Saumon", "Steak", "Steak haché"];
  const butcher = (name: string) => ({ name, aisle: "boucherie" as const });

  it("part du premier ingrédient de la boucherie ou de la poissonnerie", () => {
    expect(
      suggestBase(
        [{ name: "Oignons", aisle: "fruits_legumes" }, butcher("Blancs de poulet"), butcher("Lardons")],
        known,
      ),
    ).toBe("Poulet");
    expect(suggestBase([{ name: "Pavés de saumon", aisle: "poissonnerie" }], known)).toBe("Saumon");
  });

  it("prend la base connue la plus longue, avec son orthographe", () => {
    expect(suggestBase([butcher("Steaks hachés pur bœuf")], known)).toBe("Steak haché");
    expect(suggestBase([butcher("COTES DE PORC")], known)).toBe("Côte de porc");
  });

  it("sinon, met l'ingrédient au singulier", () => {
    expect(suggestBase([butcher("Pavés de bœuf")], known)).toBe("Pavé de bœuf");
  });

  it("ne reconnaît une base que sur des mots entiers", () => {
    expect(suggestBase([butcher("Lardons fumés")], ["Lard"])).toBe("Lardon fumé");
  });

  it("ne propose rien sans viande ni poisson", () => {
    expect(suggestBase([{ name: "Courgettes", aisle: "fruits_legumes" }], known)).toBeNull();
    expect(suggestBase([], known)).toBeNull();
  });
});

describe("uniqueBases", () => {
  it("garde une orthographe par base, dans l'ordre alphabétique", () => {
    expect(uniqueBases(["Poulet", null, "poulet", "Steak haché", "Côte de porc", " "])).toEqual([
      "Côte de porc",
      "Poulet",
      "Steak haché",
    ]);
  });
});

describe("sideLabel", () => {
  it("garde l'accompagnement d'un titre « base et accompagnement »", () => {
    expect(sideLabel("Steak haché et frites", "Steak haché")).toBe("frites");
    expect(sideLabel("Steak haché et haricots verts", "steak hache")).toBe("haricots verts");
    expect(sideLabel("Saumon, purée", "Saumon")).toBe("purée");
    expect(sideLabel("Poulet avec du riz", "Poulet")).toBe("du riz");
  });

  it("garde le titre entier quand il ne suit pas ce modèle", () => {
    expect(sideLabel("Poulet rôti et pommes de terre", "Poulet")).toBe("Poulet rôti et pommes de terre");
    expect(sideLabel("Steak et frites", "Steak haché")).toBe("Steak et frites");
    expect(sideLabel("Steak haché", "Steak haché")).toBe("Steak haché");
    expect(sideLabel("Croque-monsieur", null)).toBe("Croque-monsieur");
  });
});

type Item = { id: string; title: string; base: string | null; diets: Diet[] };
const item = (id: string, title: string, base: string | null, diets: Diet[] = []): Item => ({
  id,
  title,
  base,
  diets,
});

describe("basicRows", () => {
  const recipes = [
    item("1", "Steak haché et haricots verts", "Steak haché", ["keto"]),
    item("2", "Steak haché et frites", "Steak haché"),
    item("3", "Poulet et riz", "Poulet"),
    item("4", "Côte de porc et purée", "Côte de porc"),
    item("5", "Steak haché et purée", "steak HACHÉ"),
    item("6", "Croque-monsieur", null),
  ];

  it("fait une ligne par base, même écrite autrement, et range les recettes sans base à la fin", () => {
    expect(basicRows(recipes).map((row) => row.base)).toEqual(["Côte de porc", "Poulet", "Steak haché", "Autres"]);
  });

  it("range les recettes d'une ligne : les autres d'abord, les céto ensuite", () => {
    const steak = basicRows(recipes).find((row) => row.base === "Steak haché");
    expect(steak?.recipes.map((recipe) => recipe.id)).toEqual(["2", "5", "1"]);
  });

  it("met en tête la base demandée", () => {
    expect(basicRows(recipes, "steak hache").map((row) => row.base)).toEqual([
      "Steak haché",
      "Côte de porc",
      "Poulet",
      "Autres",
    ]);
    expect(basicRows(recipes, "Saumon")[0].base).toBe("Côte de porc");
  });
});

describe("recipePartners", () => {
  const visible = [
    item("a", "Steak haché et frites", "Steak haché"),
    item("b", "Steak haché et purée", "Steak haché"),
    item("c", "Steak haché et haricots verts", "steak haché", ["keto", "gluten_free"]),
    item("d", "Steak haché et brocolis", "Steak haché", ["keto"]),
    item("e", "Poulet et riz", "Poulet"),
  ];

  it("liste les autres recettes de même base, céto d'abord pour une recette qui ne l'est pas", () => {
    expect(recipePartners(visible[0], visible).map((recipe) => recipe.id)).toEqual(["d", "c", "b"]);
  });

  it("met les recettes pour les autres d'abord quand la recette est céto", () => {
    expect(recipePartners(visible[2], visible).map((recipe) => recipe.id)).toEqual(["a", "b", "d"]);
  });

  it("ne rend rien pour une recette sans base", () => {
    expect(recipePartners(item("x", "Gratin", null), visible)).toEqual([]);
  });
});
