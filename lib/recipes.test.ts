import { describe, expect, it } from "vitest";
import { LEA, PAUL, TOM, formData } from "@/test/helpers";
import {
  COURSES,
  EXTRA_COURSES,
  describeEaters,
  dietReason,
  filterRecipes,
  filtersFromSearchParams,
  filtersToSearchParams,
  formatDuration,
  formatIngredientQuantity,
  hideCopiedOriginals,
  incompatibleDiets,
  isExtra,
  isLightCourse,
  matchesSearch,
  memberEatability,
  normalizeText,
  parseRecipeForm,
  type RecipeFilters,
} from "./recipes";

// Un formulaire de recette valide, à compléter ou casser selon le test.
function recipeForm(fields: Record<string, string | string[]> = {}) {
  return formData({
    title: "Crêpes",
    description: "",
    photo_url: "",
    meal_types: ["petit_dej"],
    servings: "4",
    prep_minutes: "10",
    cook_minutes: "20",
    steps: "",
    batch_notes: "",
    ingredient_name: ["Farine"],
    ingredient_quantity: ["250"],
    ingredient_unit: ["g"],
    ingredient_aisle: ["epicerie"],
    ...fields,
  });
}

function parse(fields: Record<string, string | string[]> = {}, memberIds = [PAUL, LEA]) {
  return parseRecipeForm(recipeForm(fields), memberIds);
}

describe("parseRecipeForm", () => {
  it("lit une recette complète", () => {
    const result = parse({
      title: "  Crêpes  ",
      description: "Pour le goûter",
      photo_url: "https://exemple.fr/crepes.jpg",
      meal_types: ["petit_dej", "soir"],
      diets: ["vegetarian"],
      batch_friendly: "on",
      batch_notes: "Pâte la veille",
      kid_friendly: "on",
      steps: "Mélanger\nCuire",
      excluded: [LEA],
      base: "  Crêpe ",
      basic: "on",
    });
    expect(result).toEqual({
      ok: true,
      recipe: {
        title: "Crêpes",
        description: "Pour le goûter",
        photo_url: "https://exemple.fr/crepes.jpg",
        meal_types: ["petit_dej", "soir"],
        servings: 4,
        prep_minutes: 10,
        cook_minutes: 20,
        diets: ["vegetarian"],
        steps: ["Mélanger", "Cuire"],
        batch_friendly: true,
        batch_notes: "Pâte la veille",
        kid_friendly: true,
        base: "Crêpe",
        basic: true,
        course: "main",
      },
      ingredients: [{ name: "Farine", quantity: 250, unit: "g", aisle: "epicerie" }],
      excludedMemberIds: [LEA],
    });
  });

  it("laisse la base vide à null, et la recette non basique par défaut", () => {
    const result = parse({ base: "   " });
    expect(result.ok && result.recipe.base).toBeNull();
    expect(result.ok && result.recipe.basic).toBe(false);
  });

  it("lit la sorte, un plat par défaut ou si elle est inconnue", () => {
    const plain = parse();
    expect(plain.ok && plain.recipe.course).toBe("main");
    const dessert = parse({ course: "dessert" });
    expect(dessert.ok && dessert.recipe.course).toBe("dessert");
    const unknown = parse({ course: "gouter" });
    expect(unknown.ok && unknown.recipe.course).toBe("main");
  });

  it("retire l'élément principal et « basique » d'une recette qui n'est pas un plat", () => {
    const result = parse({ course: "starter", base: "Carottes", basic: "on" });
    expect(result.ok && result.recipe.base).toBeNull();
    expect(result.ok && result.recipe.basic).toBe(false);
  });

  it("accepte un fruit d'un ingrédient, pour une personne, sans étapes ni temps", () => {
    const result = parse({
      title: "Pomme",
      course: "fruit",
      meal_types: ["petit_dej", "midi", "soir", "pique_nique"],
      servings: "1",
      prep_minutes: "",
      cook_minutes: "",
      steps: "",
      diets: ["vegetarian", "gluten_free", "lactose_free"],
      ingredient_name: ["Pommes"],
      ingredient_quantity: ["1"],
      ingredient_unit: ["piece"],
      ingredient_aisle: ["fruits_legumes"],
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.recipe).toMatchObject({ course: "fruit", servings: 1, steps: [], prep_minutes: 0, cook_minutes: 0 });
    expect(result.ok && result.ingredients).toEqual([{ name: "Pommes", quantity: 1, unit: "piece", aisle: "fruits_legumes" }]);
  });

  it("refuse un élément principal de plus de 60 caractères", () => {
    expect(parse({ base: "x".repeat(60) }).ok).toBe(true);
    const result = parse({ base: "x".repeat(61) });
    expect(!result.ok && result.errors.base).toBe("Cet élément principal est trop long (60 caractères au plus).");
  });

  it("demande un titre", () => {
    expect(parse({ title: "  " })).toMatchObject({ ok: false, errors: { title: "Donne un titre à la recette." } });
  });

  it("demande au moins un repas", () => {
    expect(parse({ meal_types: [] })).toMatchObject({
      ok: false,
      errors: { meal_types: "Choisis au moins un repas." },
    });
  });

  it("refuse un nombre de personnes hors de 1 à 50", () => {
    for (const servings of ["0", "51", "", "deux"]) {
      expect(parse({ servings })).toMatchObject({
        ok: false,
        errors: { servings: "Indique un nombre de personnes, de 1 à 50." },
      });
    }
  });

  it("compte 0 minute pour un temps laissé vide", () => {
    const result = parse({ prep_minutes: "", cook_minutes: "" });
    expect(result.ok && [result.recipe.prep_minutes, result.recipe.cook_minutes]).toEqual([0, 0]);
  });

  it("refuse un temps qui n'est pas un nombre de minutes", () => {
    expect(parse({ cook_minutes: "une heure" })).toMatchObject({
      ok: false,
      errors: { cook_minutes: "Indique un temps en minutes, par exemple 20." },
    });
  });

  it("refuse une photo qui n'est pas une adresse web", () => {
    expect(parse({ photo_url: "crepes.jpg" })).toMatchObject({
      ok: false,
      errors: { photo_url: "Colle l’adresse complète de la photo, qui commence par https://." },
    });
  });

  it("lit une quantité écrite avec une virgule ou en fraction", () => {
    const result = parse({
      ingredient_name: ["Lait", "Citron"],
      ingredient_quantity: ["1,5", "1/2"],
      ingredient_unit: ["l", "piece"],
      ingredient_aisle: ["cremerie", "fruits_legumes"],
    });
    expect(result.ok && result.ingredients.map((ingredient) => ingredient.quantity)).toEqual([1.5, 0.5]);
  });

  it("ignore les lignes d'ingrédients laissées vides", () => {
    const result = parse({
      ingredient_name: ["", "Farine", "  "],
      ingredient_quantity: ["", "250", ""],
      ingredient_unit: ["g", "g", "piece"],
      ingredient_aisle: ["autre", "epicerie", "autre"],
    });
    expect(result.ok && result.ingredients).toEqual([
      { name: "Farine", quantity: 250, unit: "g", aisle: "epicerie" },
    ]);
  });

  it("demande le nom d'un ingrédient dont la quantité est remplie", () => {
    expect(
      parse({
        ingredient_name: ["Farine", ""],
        ingredient_quantity: ["250", "3"],
        ingredient_unit: ["g", "piece"],
        ingredient_aisle: ["epicerie", "autre"],
      }),
    ).toMatchObject({ ok: false, errors: { ingredients: "Ligne 2 : donne un nom à l’ingrédient." } });
  });

  it("refuse une quantité illisible", () => {
    expect(parse({ ingredient_quantity: ["beaucoup"] })).toMatchObject({
      ok: false,
      errors: { ingredients: "Ligne 1 : indique une quantité en chiffres, par exemple 250 ou 1,5." },
    });
  });

  it("garde un ingrédient sans quantité (sel, poivre) sans unité", () => {
    const result = parse({
      ingredient_name: ["Sel"],
      ingredient_quantity: [""],
      ingredient_unit: ["g"],
      ingredient_aisle: ["epicerie"],
    });
    expect(result.ok && result.ingredients).toEqual([
      { name: "Sel", quantity: null, unit: null, aisle: "epicerie" },
    ]);
  });

  it("compte en pièces une quantité sans unité, et range au rayon « autre » par défaut", () => {
    const result = parse({
      ingredient_name: ["Citrons"],
      ingredient_quantity: ["2"],
      ingredient_unit: [""],
      ingredient_aisle: [""],
    });
    expect(result.ok && result.ingredients).toEqual([
      { name: "Citrons", quantity: 2, unit: "piece", aisle: "autre" },
    ]);
  });

  it("garde une étape par ligne, sans les lignes vides", () => {
    const result = parse({ steps: "  Mélanger \n\n\r\n Cuire\n" });
    expect(result.ok && result.recipe.steps).toEqual(["Mélanger", "Cuire"]);
  });

  it("oublie les notes du dimanche d'une recette qui ne se prépare pas à l'avance", () => {
    const result = parse({ batch_notes: "Pâte la veille" });
    expect(result.ok && [result.recipe.batch_friendly, result.recipe.batch_notes]).toEqual([false, null]);
  });

  it("ne garde que les membres exclus du foyer, sans doublon", () => {
    const result = parse({ excluded: [LEA, TOM, LEA] });
    expect(result.ok && result.excludedMemberIds).toEqual([LEA]);
  });

  it("ignore les repas et régimes inconnus", () => {
    const result = parse({ meal_types: ["soir", "goûter"], diets: ["keto", "paleo"] });
    expect(result.ok && [result.recipe.meal_types, result.recipe.diets]).toEqual([["soir"], ["keto"]]);
  });
});

describe("sortes", () => {
  it("nomme les six sortes, le plat d'abord", () => {
    expect(COURSES.map((course) => [course.value, course.label])).toEqual([
      ["main", "Plat"],
      ["starter", "Entrée"],
      ["dessert", "Dessert"],
      ["fruit", "Fruit"],
      ["cheese", "Fromage"],
      ["dairy", "Laitage"],
    ]);
    expect(COURSES.every((course) => course.icon)).toBe(true);
  });

  it("range les plats légers de fin de repas : laitage, fruit, fromage, dessert", () => {
    expect(EXTRA_COURSES).toEqual(["dairy", "fruit", "cheese", "dessert"]);
  });

  it("appelle « plat léger » tout ce qui n'est pas un plat", () => {
    expect(isExtra("main")).toBe(false);
    expect(isExtra(undefined)).toBe(false);
    expect(isExtra(null)).toBe(false);
    for (const course of ["starter", "dessert", "fruit", "cheese", "dairy"] as const) expect(isExtra(course)).toBe(true);
  });

  it("propose le formulaire léger aux fruits, fromages et laitages seulement", () => {
    expect(["main", "starter", "dessert", "fruit", "cheese", "dairy"].filter((course) => isLightCourse(course as never))).toEqual([
      "fruit",
      "cheese",
      "dairy",
    ]);
  });
});

describe("formatIngredientQuantity", () => {
  it.each([
    [250, "g", 4, 6, "380 g"],
    [13, "g", 4, 5, "16 g"],
    [150, "g", 4, 5, "190 g"],
    [800, "ml", 4, 8, "1,6 l"],
    [1, "kg", 4, 6, "1,5 kg"],
    [1.2, "kg", 6, 5, "1 kg"],
    [3, "piece", 4, 5, "4"],
    [1, "piece", 4, 2, "½"],
    [1, "piece", 4, 1, "½"],
    [2, "cas", 4, 5, "2 ½ c. à soupe"],
    [1, "cac", 4, 4, "1 c. à café"],
  ] as const)("%s %s pour %s → pour %s : « %s »", (quantity, unit, servings, persons, expected) => {
    expect(formatIngredientQuantity(quantity, unit, servings, persons)).toBe(expected);
  });

  it("n'affiche rien pour un ingrédient sans quantité", () => {
    expect(formatIngredientQuantity(null, null, 4, 8)).toBe("");
  });
});

describe("formatDuration", () => {
  it.each([
    [45, "45 min"],
    [60, "1 h"],
    [75, "1 h 15"],
    [125, "2 h 05"],
  ])("%s minutes : « %s »", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe("recherche", () => {
  it("ignore accents, majuscules et ligatures", () => {
    expect(normalizeText("  Œufs à la Crème ")).toBe("oeufs a la creme");
  });

  it("trouve une recette par son titre, sans les accents", () => {
    expect(matchesSearch({ title: "Crème brûlée", ingredientNames: [] }, "creme")).toBe(true);
  });

  it("trouve une recette par un de ses ingrédients", () => {
    expect(matchesSearch({ title: "Courgettes farcies", ingredientNames: ["Bœuf haché"] }, "boeuf")).toBe(true);
  });

  it("demande que chaque mot soit trouvé", () => {
    const recipe = { title: "Gratin de chou-fleur", ingredientNames: ["Jambon"] };
    expect(matchesSearch(recipe, "chou jambon")).toBe(true);
    expect(matchesSearch(recipe, "chou saumon")).toBe(false);
  });
});

describe("filterRecipes", () => {
  const recipes = [
    { title: "Pancakes", ingredientNames: [], meal_types: ["petit_dej"], diets: ["vegetarian"], batch_friendly: true, favorite: false, basic: false },
    { title: "Saumon", ingredientNames: [], meal_types: ["soir"], diets: ["keto", "gluten_free"], batch_friendly: false, favorite: true, basic: true },
    { title: "Quiche", ingredientNames: [], meal_types: ["midi", "soir"], diets: ["keto"], batch_friendly: true, favorite: false, basic: false },
  ] as const;
  const none: RecipeFilters = { query: "", mealTypes: [], diets: [], batch: false, favorites: false, basic: false };
  const titles = (filters: Partial<RecipeFilters>) =>
    filterRecipes([...recipes], { ...none, ...filters }).map((recipe) => recipe.title);

  it("garde tout sans filtre", () => {
    expect(titles({})).toEqual(["Pancakes", "Saumon", "Quiche"]);
  });

  it("cumule les repas en « ou »", () => {
    expect(titles({ mealTypes: ["petit_dej", "midi"] })).toEqual(["Pancakes", "Quiche"]);
  });

  it("cumule les régimes en « et »", () => {
    expect(titles({ diets: ["keto", "gluten_free"] })).toEqual(["Saumon"]);
  });

  it("filtre les recettes à l'avance et les favoris", () => {
    expect(titles({ batch: true })).toEqual(["Pancakes", "Quiche"]);
    expect(titles({ favorites: true })).toEqual(["Saumon"]);
  });

  it("filtre les basiques", () => {
    expect(titles({ basic: true })).toEqual(["Saumon"]);
  });

  it("combine recherche et filtres", () => {
    expect(titles({ query: "quiche", diets: ["keto"] })).toEqual(["Quiche"]);
  });
});

describe("hideCopiedOriginals", () => {
  it("cache une recette du catalogue que le foyer a copiée : la copie la remplace", () => {
    const rows = [
      { id: "catalogue", source_recipe_id: null },
      { id: "copie", source_recipe_id: "catalogue" },
      { id: "autre", source_recipe_id: null },
    ];
    expect(hideCopiedOriginals(rows).map((row) => row.id)).toEqual(["copie", "autre"]);
  });
});

describe("filtres dans l'adresse", () => {
  it("fait l'aller-retour", () => {
    const filters: RecipeFilters = {
      query: "crème",
      // Dans l'ordre de la journée : l'adresse les écrit toujours ainsi.
      mealTypes: ["midi", "soir"],
      diets: ["keto"],
      batch: true,
      favorites: true,
      basic: true,
    };
    expect(filtersFromSearchParams(filtersToSearchParams(filters))).toEqual(filters);
    expect(filtersToSearchParams(filters).get("basiques")).toBe("1");
  });

  it("n'écrit rien quand il n'y a pas de filtre", () => {
    expect(
      filtersToSearchParams({ query: " ", mealTypes: [], diets: [], batch: false, favorites: false, basic: false }).toString(),
    ).toBe("");
  });

  it("ignore les valeurs inconnues", () => {
    expect(filtersFromSearchParams(new URLSearchParams("repas=soir,brunch&regime=paleo"))).toEqual({
      query: "",
      mealTypes: ["soir"],
      diets: [],
      batch: false,
      favorites: false,
      basic: false,
    });
  });
});

describe("qui mange quoi", () => {
  const keto = { id: LEA, diets: ["keto" as const] };
  const omnivore = { id: PAUL, diets: [] };

  it("écarte un membre dont le régime n'est pas compatible", () => {
    expect(memberEatability({ diets: ["vegetarian"] }, keto, [])).toBe("diet");
  });

  it("garde un membre dont le régime est compatible", () => {
    expect(memberEatability({ diets: ["keto", "gluten_free"] }, keto, [])).toBe("ok");
  });

  it("écarte un membre exclu à la main", () => {
    expect(memberEatability({ diets: [] }, omnivore, [PAUL])).toBe("excluded");
  });

  it("dit pourquoi un membre est écarté d'office", () => {
    expect(dietReason(["keto"])).toBe("Céto");
    expect(dietReason(["gluten_free", "keto"])).toBe("Céto, sans gluten");
  });

  it("donne le régime qui manque", () => {
    expect(incompatibleDiets(["gluten_free"], ["keto", "gluten_free", "vegetarian"])).toEqual(["keto", "vegetarian"]);
  });

  const family = [
    { id: PAUL, first_name: "Paul" },
    { id: LEA, first_name: "Léa" },
    { id: TOM, first_name: "Tom" },
  ];

  it.each([
    [[], "Pour tout le monde"],
    [[LEA], "Sauf Léa"],
    [[LEA, TOM], "Pour Paul"],
    [[PAUL, LEA, TOM], "Pour personne"],
  ])("%j : « %s »", (outIds, expected) => {
    expect(describeEaters(family, outIds)).toBe(expected);
  });

  it("nomme les absents quand ils sont moins nombreux", () => {
    const five = [...family, { id: "a", first_name: "Anna" }, { id: "b", first_name: "Otis" }];
    expect(describeEaters(five, [LEA, TOM])).toBe("Sauf Léa et Tom");
  });
});
