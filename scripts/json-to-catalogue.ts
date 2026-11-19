// Transforme un lot de recettes en JSON (recettes-basiques.json…) en migration SQL pour le
// catalogue commun (household_id null). Chaque recette reçoit un identifiant fixe, dérivé de
// son titre : rejouer la migration, ou réimporter une recette déjà présente, ne crée pas de
// doublon (« on conflict do nothing »).
//
// Lancer (Node 26 exécute le TypeScript directement) :
//   docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     scripts/json-to-catalogue.ts recettes-basiques.json supabase/migrations/0007_basics_catalog.sql
//
// Format du JSON : { "recettes": [ { titre, description, base?, accompagnement?, types,
// portions, prep, cuisson, regimes, batch, batch_notes, kid_friendly, basique?,
// ingredients: [[nom, quantité, unité, rayon]], etapes } ] }. `accompagnement` sert à la
// lecture du fichier seulement : il n'est pas stocké.
//
// Référentiel d'ingrédients (0009) : chaque ligne insérée est rattachée à son ingrédient canonique
// par le trigger recipe_ingredients_set_ingredient (nom ou alias normalisés, sinon un nouvel
// ingrédient commun). Pour un produit nouveau, ajoute-le d'abord au référentiel commun (avec son
// rayon, son unité d'achat, ses alias) dans la même migration, avant les recettes.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

export type JsonIngredient = [string, number | null, string | null, string];

export type JsonRecipe = {
  titre: string;
  description?: string | null;
  base?: string | null;
  accompagnement?: string | null;
  types: string[];
  portions: number;
  prep?: number;
  cuisson?: number;
  regimes?: string[];
  batch?: boolean;
  batch_notes?: string | null;
  kid_friendly?: boolean;
  basique?: boolean;
  ingredients: JsonIngredient[];
  etapes: string[];
};

const MEAL_TYPES = ["petit_dej", "midi", "soir", "pique_nique"];
const DIETS: Record<string, string> = {
  keto: "keto",
  vegetarien: "vegetarian",
  sans_gluten: "gluten_free",
  sans_lactose: "lactose_free",
};
const UNITS = ["g", "kg", "ml", "l", "piece", "cas", "cac"];
const AISLES = [
  "fruits_legumes",
  "boucherie",
  "poissonnerie",
  "cremerie",
  "epicerie",
  "surgeles",
  "boulangerie",
  "boissons",
  "autre",
];

// Même règle que normalizeText (lib/recipes.ts), recopiée : le script tourne hors de Next.
function normalize(text: string) {
  return text
    .toLocaleLowerCase("fr")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// UUID au format v5 : SHA-1 du titre normalisé, avec les bits de version et de variante.
export function recipeId(title: string): string {
  const bytes = createHash("sha1").update(`popote-catalogue:${normalize(title)}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function text(value: string | null | undefined) {
  return value === null || value === undefined ? "null" : `'${value.replace(/'/g, "''")}'`;
}

function textArray(values: string[], type: string) {
  return `array[${values.map(text).join(", ")}]::${type}[]`;
}

function wholeNumber(value: unknown, min: number, max: number) {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

// Vérifie une recette ; toute erreur nomme la recette, pour la retrouver dans le JSON.
function check(recipe: JsonRecipe) {
  const fail = (message: string): never => {
    throw new Error(`« ${recipe.titre} » : ${message}`);
  };
  const title = recipe.titre?.trim() ?? "";
  if (title.length < 1 || title.length > 120) fail("titre vide ou trop long (120 caractères au plus)");
  if ((recipe.description ?? "").length > 300) fail("description trop longue (300 caractères au plus)");
  if (recipe.base != null && (recipe.base.trim().length < 1 || recipe.base.trim().length > 60)) {
    fail("base vide ou trop longue (60 caractères au plus)");
  }
  if (recipe.types.length === 0) fail("aucun type de repas");
  for (const type of recipe.types) if (!MEAL_TYPES.includes(type)) fail(`type de repas inconnu : ${type}`);
  for (const diet of recipe.regimes ?? []) if (!(diet in DIETS)) fail(`régime inconnu : ${diet}`);
  if (!wholeNumber(recipe.portions, 1, 50)) fail("portions : un entier de 1 à 50");
  if (!wholeNumber(recipe.prep ?? 0, 0, 1440) || !wholeNumber(recipe.cuisson ?? 0, 0, 1440)) {
    fail("temps : des minutes entières, de 0 à 1440");
  }
  if (recipe.ingredients.length === 0) fail("aucun ingrédient");
  for (const [name, quantity, unit, aisle] of recipe.ingredients) {
    if (!name?.trim() || name.trim().length > 80) fail(`ingrédient sans nom ou trop long : ${name}`);
    if ((quantity === null) !== (unit === null)) fail(`${name} : quantité et unité vont ensemble`);
    if (quantity !== null && !(quantity > 0)) fail(`${name} : quantité positive attendue`);
    if (unit !== null && !UNITS.includes(unit)) fail(`${name} : unité inconnue : ${unit}`);
    if (!AISLES.includes(aisle)) fail(`${name} : rayon inconnu : ${aisle}`);
  }
}

// Une instruction par recette : la recette, puis ses ingrédients seulement si elle vient d'être
// créée (rien n'est ajouté à une recette déjà présente).
function recipeSql(recipe: JsonRecipe) {
  const diets = (recipe.regimes ?? []).map((diet) => DIETS[diet]);
  const items = recipe.ingredients.map(
    ([name, quantity, unit, aisle], index) =>
      `    (${index}::smallint, ${text(name.trim())}, ${quantity === null ? "null" : quantity}::numeric, ` +
      `${text(unit)}::public.ingredient_unit, ${text(aisle)}::public.grocery_aisle)`,
  );
  return `-- ${recipe.titre.trim()}
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    ${text(recipeId(recipe.titre))}, null, ${text(recipe.titre.trim())}, ${text(recipe.description ?? null)},
    ${textArray(recipe.types, "public.meal_type")}, ${recipe.portions}, ${recipe.prep ?? 0}, ${recipe.cuisson ?? 0},
    ${textArray(diets, "public.diet")},
    ${textArray(recipe.etapes, "text")},
    ${recipe.batch ?? false}, ${text(recipe.batch_notes ?? null)}, ${recipe.kid_friendly ?? false}, ${text(recipe.base?.trim() ?? null)}, ${recipe.basique ?? false}
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
${items.join(",\n")}
) as item (position, name, quantity, unit, aisle);
`;
}

export function catalogueSql(doc: { recettes: JsonRecipe[] }, source: string, output = "<migration>.sql"): string {
  const seen = new Set<string>();
  for (const recipe of doc.recettes) {
    check(recipe);
    const key = normalize(recipe.titre);
    if (seen.has(key)) throw new Error(`« ${recipe.titre} » : titre en double`);
    seen.add(key);
  }

  const count = doc.recettes.length;
  return `-- Catalogue commun : ${count} ${count > 1 ? "recettes importées" : "recette importée"} de ${source}.
-- Fichier généré, ne pas modifier à la main. Pour le régénérer :
--   docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/json-to-catalogue.ts ${source} ${output}
-- Identifiants fixes dérivés du titre, « on conflict do nothing » : rejouable sans doublon.

${doc.recettes.map(recipeSql).join("\n")}`;
}

if (import.meta.main) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error("Usage : node scripts/json-to-catalogue.ts <recettes.json> <migration.sql>");
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(input, "utf8")) as { recettes: JsonRecipe[] };
  writeFileSync(output, catalogueSql(doc, input, output));
  console.log(`${doc.recettes.length} recettes écrites dans ${output}`);
}
