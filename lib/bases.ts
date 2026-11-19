import type { Diet } from "@/lib/members";
import { normalizeText, type GroceryAisle } from "@/lib/recipes";

// Recettes associées : deux recettes de même élément principal (« base ») se cuisinent
// ensemble, avec deux accompagnements (frites pour la famille, haricots verts pour qui mange
// céto). Code pur, testé par lib/bases.test.ts.

function key(base: string | null | undefined) {
  return normalizeText(base ?? "").replace(/\s+/g, " ");
}

// La base comparable (sans accents, majuscules ni espaces en trop), ou null sans base.
export function baseKey(base: string | null | undefined): string | null {
  return key(base) || null;
}

export function sameBase(a: string | null | undefined, b: string | null | undefined) {
  const first = key(a);
  return first !== "" && first === key(b);
}

// ─── Pré-remplir la base ────────────────────────────────────────────────────

// Après l'un de ces mots, le nom ne se met plus au singulier : « Cuisses de poulet ».
const PREPOSITIONS = new Set(["de", "du", "des", "a", "au", "aux", "en", "pour", "avec", "sans"]);
const INVARIABLE = new Set(["travers", "noix", "pois", "dos", "gras", "anchois", "radis", "riz", "jus", "frais"]);

function singularWord(word: string) {
  const plain = normalizeText(word);
  if (INVARIABLE.has(plain)) return word;
  if (/(eau|eu)x$/.test(plain)) return word.slice(0, -1);
  if (plain.length > 3 && plain.endsWith("s") && !plain.endsWith("ss")) return word.slice(0, -1);
  return word;
}

// « Steaks hachés pur bœuf » → « Steak haché pur bœuf », « Côtes de porc » → « Côte de porc ».
export function singularize(name: string) {
  const words = name.trim().split(/\s+/);
  const stop = words.findIndex((word) => PREPOSITIONS.has(normalizeText(word)) || /^d['’]/i.test(word));
  const head = stop === -1 ? words.length : stop;
  return words.map((word, index) => (index < head ? singularWord(word) : word)).join(" ");
}

// La base proposée pour une nouvelle recette : son premier ingrédient de la boucherie ou de la
// poissonnerie ; une base déjà connue s'il la contient (la plus longue, en mots entiers : les
// recettes s'associent sans retouche), sinon son nom au singulier.
export function suggestBase(
  ingredients: readonly { name: string; aisle: GroceryAisle }[],
  knownBases: readonly string[],
): string | null {
  const main = ingredients.find((item) => item.aisle === "boucherie" || item.aisle === "poissonnerie");
  if (!main?.name.trim()) return null;
  const singular = singularize(main.name);
  const words = ` ${key(singular)} `;
  const known = knownBases
    .filter((base) => key(base) !== "" && words.includes(` ${key(base)} `))
    .sort((a, b) => key(b).length - key(a).length);
  return known[0] ?? singular;
}

// Une orthographe par base (la première rencontrée), pour l'autocomplétion.
export function uniqueBases(bases: readonly (string | null)[]): string[] {
  const byKey = new Map<string, string>();
  for (const base of bases) {
    const trimmed = base?.trim();
    if (trimmed && !byKey.has(key(trimmed))) byKey.set(key(trimmed), trimmed);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

// ─── Les basiques ───────────────────────────────────────────────────────────

// L'accompagnement, quand le titre s'écrit « <base> et … », « <base>, … » ou « <base> avec … » :
// « Steak haché et frites » → « frites ». Sinon le titre entier.
export function sideLabel(title: string, base: string | null) {
  if (!base?.trim()) return title;
  const words = title.trim().split(/\s+/);
  const size = base.trim().split(/\s+/).length;
  let head = words.slice(0, size).join(" ");
  const comma = head.endsWith(",");
  if (comma) head = head.slice(0, -1);
  if (!sameBase(head, base)) return title;

  let rest = words.slice(size);
  if (!comma) {
    if (!["et", "avec"].includes(normalizeText(rest[0] ?? ""))) return title;
    rest = rest.slice(1);
  }
  return rest.join(" ") || title;
}

const isKeto = (recipe: { diets: readonly Diet[] }) => recipe.diets.includes("keto");

export const OTHER_BASICS = "Autres";

// Les basiques en lignes, une par base (orthographe de la première recette rencontrée), dans
// l'ordre alphabétique ; `firstBase` passe en tête ; les recettes sans base finissent dans
// « Autres ». Dans une ligne : les recettes pour tous d'abord, les céto ensuite.
export function basicRows<T extends { title: string; base: string | null; diets: readonly Diet[] }>(
  recipes: readonly T[],
  firstBase?: string | null,
): { base: string; recipes: T[] }[] {
  const rows = new Map<string, { base: string; recipes: T[] }>();
  const others: T[] = [];
  for (const recipe of recipes) {
    if (!key(recipe.base)) {
      others.push(recipe);
      continue;
    }
    const row = rows.get(key(recipe.base)) ?? { base: recipe.base!.trim(), recipes: [] };
    row.recipes.push(recipe);
    rows.set(key(recipe.base), row);
  }

  const bySide = (a: T, b: T) =>
    Number(isKeto(a)) - Number(isKeto(b)) ||
    sideLabel(a.title, a.base).localeCompare(sideLabel(b.title, b.base), "fr");
  const sorted = [...rows.values()]
    .map((row) => ({ ...row, recipes: row.recipes.sort(bySide) }))
    .sort(
      (a, b) =>
        Number(!sameBase(a.base, firstBase)) - Number(!sameBase(b.base, firstBase)) ||
        a.base.localeCompare(b.base, "fr"),
    );
  return others.length > 0 ? [...sorted, { base: OTHER_BASICS, recipes: others.sort(bySide) }] : sorted;
}

// « Se marie avec » : les autres recettes de même base. Celles dont le caractère céto diffère
// d'abord (sur « Steak haché et frites », la version céto), puis par titre.
export function recipePartners<T extends { id: string; title: string; base: string | null; diets: readonly Diet[] }>(
  recipe: T,
  visible: readonly T[],
): T[] {
  return visible
    .filter((other) => other.id !== recipe.id && sameBase(other.base, recipe.base))
    .sort(
      (a, b) =>
        Number(isKeto(a) === isKeto(recipe)) - Number(isKeto(b) === isKeto(recipe)) ||
        a.title.localeCompare(b.title, "fr"),
    );
}
