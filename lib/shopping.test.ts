import { describe, expect, it } from "vitest";
import type { PortionMember } from "./portions";
import {
  buildShoppingList,
  formatAmounts,
  itemKey,
  menuSignature,
  mergeShoppingItems,
  roundForPurchase,
  shoppingListText,
  shoppingProgress,
  shoppingSections,
  sourceLabel,
  usageLabel,
  type ComputedItem,
  type ShoppingIngredient,
  type ShoppingMeal,
  type ShoppingRecipe,
  type StoredItem,
} from "./shopping";

// ─── Le foyer de test, semaine du lundi 23 novembre 2026 ────────────────────
const WEEK = "2026-11-23";
const members: PortionMember[] = [
  { id: "olivier", birth_year: 1986, appetite: "normal" },
  { id: "marie-laure", birth_year: 1986, appetite: "normal" },
  { id: "timothe", birth_year: 2010, appetite: "grand" },
  { id: "anna-lucia", birth_year: 2017, appetite: "normal" },
  { id: "otis", birth_year: 2020, appetite: "normal" },
];
const FAMILY = ["olivier", "timothe", "anna-lucia", "otis"]; // 3,9 portions
const ML = ["marie-laure"];

function ingredient(id: string, name: string, fields: Partial<ShoppingIngredient> = {}): ShoppingIngredient {
  return { id, name, aisle: "epicerie", shopping_unit: "g", piece_grams: null, grams_per_ml: null, pantry: false, ...fields };
}

const ingredients: ShoppingIngredient[] = [
  ingredient("steak", "Steaks hachés pur bœuf", { aisle: "boucherie", shopping_unit: "piece" }),
  ingredient("frites", "Frites surgelées au four", { aisle: "surgeles" }),
  ingredient("haricots", "Haricots verts", { aisle: "surgeles" }),
  ingredient("huile", "Huile d'olive", { shopping_unit: "ml", grams_per_ml: 0.92, pantry: true }),
  ingredient("creme", "Crème fraîche épaisse", { aisle: "cremerie", grams_per_ml: 1 }),
  ingredient("lait", "Lait", { aisle: "cremerie", shopping_unit: "ml" }),
  ingredient("parmesan", "Parmesan", { aisle: "cremerie" }),
  ingredient("jambon", "Tranches de jambon blanc", { aisle: "boucherie", shopping_unit: "piece" }),
  ingredient("tortillas", "Tortillas de blé", { shopping_unit: "piece" }),
  ingredient("salade", "Salades vertes", { aisle: "fruits_legumes", shopping_unit: "piece" }),
  ingredient("persil", "Persil", { aisle: "fruits_legumes", shopping_unit: "piece" }),
  ingredient("pdt", "Pommes de terre", { aisle: "fruits_legumes" }),
];

type Line = [ingredientId: string | null, name: string, quantity: number | null, unit: ShoppingRecipe["ingredients"][number]["unit"]];

function recipe(id: string, title: string, servings: number, lines: Line[]): ShoppingRecipe {
  return {
    id,
    title,
    servings,
    ingredients: lines.map(([ingredient_id, name, quantity, unit]) => ({ ingredient_id, name, quantity, unit, aisle: "epicerie" })),
  };
}

const recipes: ShoppingRecipe[] = [
  recipe("frites", "Steak haché et frites", 4, [
    ["steak", "Steaks hachés pur bœuf", 4, "piece"],
    ["huile", "Huile d'olive", 1, "cas"],
    ["frites", "Frites surgelées au four", 800, "g"],
    [null, "Sel", null, null],
  ]),
  recipe("haricots", "Steak haché et haricots verts", 4, [
    ["steak", "Steaks hachés pur bœuf", 4, "piece"],
    ["huile", "Huile d'olive", 1, "cas"],
    ["haricots", "Haricots verts", 600, "g"],
  ]),
  // Midis céto de Marie-Laure : une recette pour une personne.
  recipe("salade-keto", "Salade de saumon à la crème", 1, [
    ["creme", "Crème fraîche épaisse", 2, "cas"],
    ["salade", "Laitue", 0.5, "piece"],
    ["parmesan", "Parmesan", 2, "cas"],
  ]),
  recipe("gratin-keto", "Gratin de courgettes", 1, [
    ["creme", "Crème fraîche épaisse", 200, "g"],
    ["parmesan", "Parmesan", 200, "g"],
    ["persil", "Persil", null, null],
  ]),
  // Pique-nique du mercredi pour Anna-Lucia et Otis (1,4 portion).
  recipe("wraps", "Wraps au jambon", 2, [
    ["jambon", "Tranches de jambon blanc", 4, "piece"],
    ["tortillas", "Tortillas de blé", 2, "piece"],
  ]),
  recipe("porridge", "Porridge", 2, [["lait", "Lait", 1, "l"]]),
  recipe("chocolat", "Chocolat chaud", 2, [["lait", "Lait", 800, "ml"]]),
  recipe("puree", "Purée", 2, [["pdt", "Pommes de terre", 1.5, "kg"]]),
];

function meal(day: number, meal_type: ShoppingMeal["meal_type"], recipe_id: string, member_ids: string[]): ShoppingMeal {
  return { day, meal_type, recipe_id, member_ids };
}

const week: ShoppingMeal[] = [
  meal(0, "soir", "frites", FAMILY),
  meal(0, "soir", "haricots", ML),
  meal(0, "midi", "salade-keto", ML),
  meal(1, "midi", "gratin-keto", ML),
  meal(2, "pique_nique", "wraps", ["anna-lucia", "otis"]),
];

function build(meals: ShoppingMeal[] = week, stock?: Record<string, number>) {
  return buildShoppingList({ meals, recipes, members, ingredients, weekStart: WEEK, stock });
}

function item(items: ComputedItem[], key: string) {
  const found = items.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`Pas d'article ${key}`);
  return found;
}

describe("buildShoppingList", () => {
  it("cumule un ingrédient de deux recettes, chacune à l'échelle de ses mangeurs", () => {
    // 4 × 3,9 / 4 + 4 × 1 / 4 = 4,9 steaks → 5
    expect(item(build(), "steak").amounts).toEqual([{ quantity: 5, unit: "piece" }]);
  });

  it("garde les sources : recette, jour, repas, nombre de convives", () => {
    expect(item(build(), "steak").sources).toEqual([
      { recipeId: "frites", recipeTitle: "Steak haché et frites", day: 0, mealType: "soir", eaters: 4 },
      { recipeId: "haricots", recipeTitle: "Steak haché et haricots verts", day: 0, mealType: "soir", eaters: 1 },
    ]);
  });

  it("applique les coefficients de portion (Anna-Lucia et Otis : 0,7 chacun)", () => {
    // 4 tranches pour 2, mangées par 1,4 portion : 2,8 → 3
    expect(item(build(), "jambon").amounts).toEqual([{ quantity: 3, unit: "piece" }]);
  });

  it("convertit la crème en c. à soupe en g grâce à la densité, puis arrondit", () => {
    // 2 c. à soupe = 30 ml = 30 g, + 200 g = 230 g → 250 g
    expect(item(build(), "creme").amounts).toEqual([{ quantity: 250, unit: "g" }]);
  });

  it("additionne le lait en l et en ml", () => {
    const items = build([meal(1, "petit_dej", "porridge", ["olivier", "marie-laure"]), meal(2, "petit_dej", "chocolat", ["olivier", "marie-laure"])]);
    expect(item(items, "lait").amounts).toEqual([{ quantity: 1800, unit: "ml" }]);
    expect(formatAmounts(item(items, "lait").amounts)).toBe("1,8 l");
  });

  it("garde deux morceaux quand une conversion manque", () => {
    expect(formatAmounts(item(build(), "parmesan").amounts)).toBe("200 g + 2 c. à soupe");
  });

  it("ramène les kg en g", () => {
    const items = build([meal(3, "soir", "puree", ["olivier", "marie-laure"])]);
    expect(item(items, "pdt").amounts).toEqual([{ quantity: 1500, unit: "g" }]);
    expect(formatAmounts(item(items, "pdt").amounts)).toBe("1,5 kg");
  });

  it("sort les produits du placard sans quantité, avec leurs sources", () => {
    const huile = item(build(), "huile");
    expect(huile).toMatchObject({ pantry: true, amounts: [] });
    expect(usageLabel(huile.sources)).toBe("pour 2 recettes");
  });

  it("range au placard une ligne sans ingrédient", () => {
    expect(item(build(), "nom:sel")).toMatchObject({ label: "Sel", pantry: true, amounts: [], ingredientId: null });
  });

  it("garde un ingrédient sans quantité dans son rayon, sans quantité", () => {
    expect(item(build(), "persil")).toMatchObject({ aisle: "fruits_legumes", pantry: false, amounts: [] });
  });

  it("trie par rayon dans l'ordre du drive, puis par nom ; le placard à la fin", () => {
    expect(build().map((entry) => entry.label)).toEqual([
      "Persil",
      "Salades vertes",
      "Steaks hachés pur bœuf",
      "Tranches de jambon blanc",
      "Crème fraîche épaisse",
      "Parmesan",
      "Tortillas de blé",
      "Frites surgelées au four",
      "Haricots verts",
      "Huile d'olive",
      "Sel",
    ]);
  });

  it("déduit le stock avant d'arrondir, et retire ce qui est déjà à la maison", () => {
    const items = build(week, { creme: 100, steak: 10 });
    expect(item(items, "creme").amounts).toEqual([{ quantity: 130, unit: "g" }]);
    expect(items.some((entry) => entry.key === "steak")).toBe(false);
  });
});

describe("roundForPurchase", () => {
  it("arrondit au-dessus : pièces à l'unité, g et ml à 10 sous 200, à 50 au-delà, jamais 0", () => {
    expect(roundForPurchase(0.2, "piece")).toBe(1);
    expect(roundForPurchase(2.0000000000000004, "piece")).toBe(2);
    expect(roundForPurchase(4, "g")).toBe(10);
    expect(roundForPurchase(191, "g")).toBe(200);
    expect(roundForPurchase(200, "ml")).toBe(200);
    expect(roundForPurchase(201, "g")).toBe(250);
    expect(roundForPurchase(1.2, "cas")).toBe(2);
  });
});

describe("formatAmounts", () => {
  it("écrit les quantités à la française", () => {
    expect(formatAmounts([{ quantity: 1250, unit: "g" }])).toBe("1,25 kg");
    expect(formatAmounts([{ quantity: 950, unit: "ml" }])).toBe("950 ml");
    expect(formatAmounts([{ quantity: 6, unit: "piece" }])).toBe("6");
    expect(formatAmounts([{ quantity: 1, unit: "cac" }])).toBe("1 c. à café");
    expect(formatAmounts([])).toBe("");
  });
});

describe("sourceLabel", () => {
  it("« Recette · jour repas · N pers. »", () => {
    expect(sourceLabel({ recipeId: "frites", recipeTitle: "Steak haché et frites", day: 0, mealType: "soir", eaters: 4 })).toBe(
      "Steak haché et frites · lun. soir · 4 pers.",
    );
    expect(sourceLabel({ recipeId: "wraps", recipeTitle: "Wraps au jambon", day: 2, mealType: "pique_nique", eaters: 2 })).toBe(
      "Wraps au jambon · mer. pique-nique · 2 pers.",
    );
  });

  it("compte les recettes distinctes", () => {
    const source = { recipeId: "frites", recipeTitle: "Steak haché et frites", day: 0, mealType: "soir" as const, eaters: 4 };
    expect(usageLabel([source, { ...source, day: 3 }])).toBe("pour 1 recette");
  });
});

describe("menuSignature", () => {
  it("ne dépend ni de l'ordre des plats ni de celui des mangeurs", () => {
    const shuffled = [...week].reverse().map((entry) => ({ ...entry, member_ids: [...entry.member_ids].reverse() }));
    expect(menuSignature(shuffled)).toBe(menuSignature(week));
  });

  it("change quand un mangeur ou une recette change", () => {
    const signature = menuSignature(week);
    expect(menuSignature(week.map((entry, index) => (index === 0 ? { ...entry, member_ids: ["olivier"] } : entry)))).not.toBe(signature);
    expect(menuSignature(week.map((entry, index) => (index === 0 ? { ...entry, recipe_id: "puree" } : entry)))).not.toBe(signature);
  });
});

// ─── Liste enregistrée ──────────────────────────────────────────────────────
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
    ...fields,
  };
}

function computed(key: string, amounts: ComputedItem["amounts"], fields: Partial<ComputedItem> = {}): ComputedItem {
  return { key, ingredientId: key, label: key, aisle: "epicerie", pantry: false, amounts, sources: [], ...fields };
}

describe("mergeShoppingItems", () => {
  const previous = [
    stored({ ingredient_id: "riz", label: "Riz", amounts: [{ quantity: 500, unit: "g" }], checked: true }),
    stored({ ingredient_id: "lait", label: "Lait", amounts: [{ quantity: 1000, unit: "ml" }], checked: true }),
    stored({ ingredient_id: "creme", label: "Crème", amounts: [{ quantity: 200, unit: "g" }], checked: true }),
    stored({ ingredient_id: "oeufs", label: "Œufs", amounts: [{ quantity: 6, unit: "piece" }], removed: true }),
    stored({ ingredient_id: "sel", label: "Sel", pantry: true, needed: true }),
    stored({ ingredient_id: "ancien", label: "Plus au menu", checked: true }),
    stored({ label: "Bougies", manual: true, quantity_text: "2" }),
  ];

  const merged = mergeShoppingItems(previous, [
    computed("riz", [{ quantity: 450, unit: "g" }]),
    computed("lait", [{ quantity: 1500, unit: "ml" }]),
    computed("creme", [{ quantity: 200, unit: "g" }, { quantity: 1, unit: "cas" }]),
    computed("oeufs", [{ quantity: 12, unit: "piece" }]),
    computed("sel", [], { pantry: true }),
    computed("pates", [{ quantity: 500, unit: "g" }]),
  ]);
  const byKey = (key: string) => merged.find((entry) => itemKey(entry) === key);

  it("garde une case cochée si la quantité n'a pas augmenté", () => {
    expect(byKey("riz")).toMatchObject({ checked: true, quantity_changed: false, amounts: [{ quantity: 450, unit: "g" }] });
  });

  it("décoche et signale une quantité qui augmente, ou une unité nouvelle", () => {
    expect(byKey("lait")).toMatchObject({ checked: false, quantity_changed: true });
    expect(byKey("creme")).toMatchObject({ checked: false, quantity_changed: true });
  });

  it("garde « J'en ai déjà » et un article du placard passé dans la liste", () => {
    expect(byKey("oeufs")).toMatchObject({ removed: true, quantity_changed: false });
    expect(byKey("sel")).toMatchObject({ needed: true });
  });

  it("retire ce qui n'est plus au menu, ajoute le nouveau décoché, ignore les articles manuels", () => {
    expect(byKey("ancien")).toBeUndefined();
    expect(byKey("pates")).toMatchObject({ checked: false, manual: false });
    expect(merged.some((entry) => entry.manual)).toBe(false);
    expect(merged.map((entry) => entry.position)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("un menu vide ne laisse aucun article calculé", () => {
    expect(mergeShoppingItems(previous, [])).toEqual([]);
  });
});

describe("shoppingSections et shoppingProgress", () => {
  const items = [
    stored({ ingredient_id: "oignons", label: "Oignons", aisle: "fruits_legumes", position: 1, checked: true }),
    stored({ ingredient_id: "courgettes", label: "Courgettes", aisle: "fruits_legumes", position: 2 }),
    stored({ label: "Bananes", aisle: "fruits_legumes", manual: true, position: 0 }),
    stored({ ingredient_id: "steak", label: "Steaks", aisle: "boucherie", position: 0, checked: true }),
    stored({ ingredient_id: "sel", label: "Sel", aisle: "epicerie", pantry: true, position: 3 }),
    stored({ ingredient_id: "huile", label: "Huile d'olive", aisle: "epicerie", pantry: true, needed: true, position: 4 }),
    stored({ ingredient_id: "oeufs", label: "Œufs", aisle: "cremerie", removed: true, position: 5 }),
  ];

  it("range la liste par rayon : non cochés, puis cochés ; les manuels après les calculés", () => {
    const { aisles } = shoppingSections(items);
    expect(aisles.map((aisle) => [aisle.label, aisle.remaining, aisle.items.map((entry) => entry.label)])).toEqual([
      ["Fruits et légumes", 2, ["Courgettes", "Bananes", "Oignons"]],
      ["Boucherie", 0, ["Steaks"]],
      ["Épicerie", 1, ["Huile d'olive"]],
    ]);
  });

  it("sépare le placard et ce qui est déjà à la maison", () => {
    const { pantry, home } = shoppingSections(items);
    expect(pantry.map((entry) => entry.label)).toEqual(["Sel"]);
    expect(home.map((entry) => entry.label)).toEqual(["Œufs"]);
  });

  it("compte la progression sur les articles à acheter", () => {
    expect(shoppingProgress(items)).toEqual({ done: 2, total: 5 });
  });
});

describe("shoppingListText", () => {
  it("écrit les articles non cochés, par rayon, pour une note ou le drive", () => {
    const items = [
      stored({ ingredient_id: "oignons", label: "Oignons", aisle: "fruits_legumes", amounts: [{ quantity: 4, unit: "piece" }] }),
      stored({ ingredient_id: "persil", label: "Persil", aisle: "fruits_legumes", position: 1 }),
      stored({ ingredient_id: "steak", label: "Steaks", aisle: "boucherie", checked: true }),
      stored({ ingredient_id: "creme", label: "Crème fraîche épaisse", aisle: "cremerie", amounts: [{ quantity: 250, unit: "g" }] }),
      stored({ label: "Bougies", manual: true, quantity_text: "2 paquets" }),
      stored({ ingredient_id: "sel", label: "Sel", pantry: true }),
    ];
    expect(shoppingListText("Semaine du 23 au 29 novembre", items)).toBe(
      [
        "Courses · Semaine du 23 au 29 novembre",
        "",
        "Fruits et légumes",
        "- Oignons : 4",
        "- Persil",
        "",
        "Crèmerie",
        "- Crème fraîche épaisse : 250 g",
        "",
        "Autre",
        "- Bougies : 2 paquets",
      ].join("\n"),
    );
  });
});
