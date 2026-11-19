# Recettes associées et basiques : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** associer les recettes qui partagent un élément principal (`recipes.base`) et offrir un panneau « Les basiques » (`recipes.basic`) pour choisir vite un plat simple.

**Architecture:** deux colonnes sur `recipes` ; l'association se calcule en TypeScript (`normalizeText`) sur les recettes visibles déjà chargées. Les 35 basiques arrivent par une migration générée depuis le JSON. Le code pur (bases, filtres, planificateur) vit dans `lib/` et se teste avec Vitest ; l'interface réutilise les composants de `/design` plus un nouveau `RecipeChip`.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres, RLS, pgTAP), Vitest, Playwright, Node 26 (TypeScript natif pour le script).

**Spec:** `docs/superpowers/specs/2026-11-19-recettes-associees-design.md`

## Global Constraints

- Interface en français, au tutoiement ; code et noms en anglais.
- Aucun style ad hoc : composants de `/design` ; tout nouveau composant est montré sur `/design`.
- `base` : 1 à 60 caractères après `btrim`, vide → `null`. `basic` : `false` par défaut.
- Aide du champ : « Deux recettes avec le même élément principal se cuisinent ensemble. »
- Régimes du JSON gardés tels quels (`sans_lactose` → `lactose_free`).
- Les recettes `basic` n'entrent jamais dans `proposeWeek` ni `nextIdea`.
- Formulaire prérempli : clé React dérivée des données enregistrées (déjà en place, ne pas casser).

## Review Focus

- Une recette du catalogue copiée par le foyer : elle ne doit apparaître qu'une fois (la copie) dans « Se marie avec » et dans « Les basiques ». → test `basicRows`/`recipePartners` avec copie.
- Bases écrites différemment (« steak haché », « Steak Haché ») : même groupe. → test `basicRows`.
- Recette basique sans base : elle reste visible (ligne « Autres »). → test `basicRows`.
- Carte verrouillée sur une basique : la proposition la garde et tient compte de sa viande. → test planner.
- Ingrédient boucherie au pluriel invariable (« Travers de porc », « Noix de veau ») : pas de singulier abîmé. → test `singularize`.

---

### Task 1 : schéma, fonctions SQL, bases du catalogue 0003

**Files:**
- Create: `supabase/migrations/0006_recipe_base_basic.sql`
- Modify: `supabase/tests/recipes.test.sql`, `lib/supabase/database.types.ts` (régénéré)

**Produces:** colonnes `recipes.base text null`, `recipes.basic boolean not null default false` ; `save_recipe` lit `recipe.base`, `recipe.basic` ; `copy_recipe` les recopie.

- [ ] Tests pgTAP (dans `recipes.test.sql`, plan augmenté) : `save_recipe` enregistre `base = 'Steak haché'` (avec espaces autour → rognés) et `basic = true` ; `base = '   '` → `null` ; mise à jour change `base` ; `base` de 61 caractères refusée (`23514`) ; `copy_recipe` recopie `base` et `basic` ; bases 0003 : `…15` et `…21` = `Poulet`, `…22` = `Saumon`, les 37 autres `null`.
- [ ] `supabase db reset` puis `supabase test db` : les nouveaux tests échouent.
- [ ] Migration : `alter table` + `comment on column` ; `create or replace` des deux fonctions (copier le corps actuel de 0002/0005 et ajouter les colonnes ; `copy_recipe` garde la mise à jour de `planned_meals`) ; `update` des trois bases par id, puis des copies (`source_recipe_id` dans ces ids, `base is null`).
- [ ] `supabase db reset && supabase test db` : tout passe. Régénérer les types.
- [ ] Commit.

### Task 2 : import des basiques

**Files:**
- Create: `scripts/json-to-catalogue.ts`, `scripts/json-to-catalogue.test.ts`, `supabase/migrations/0007_basics_catalog.sql` (généré)
- Modify: `supabase/tests/catalog.test.sql`, `README.md`, ajouter `recettes-basiques.json` au dépôt

**Produces:** `catalogueSql(doc: { recettes: JsonRecipe[] }, source: string): string`, `recipeId(title: string): string` ; CLI `node scripts/json-to-catalogue.ts <entrée.json> <sortie.sql>`.

- [ ] Vitest : `recipeId("Steak haché et frites")` est stable, au format UUID v5 (`/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`) et ne dépend ni de la casse ni des accents ; `catalogueSql` contient `on conflict (id) do nothing`, mappe `sans_lactose` → `lactose_free`, échappe les apostrophes (`Huile d''olive`), écrit `base` et `basic`, n'écrit pas `accompagnement` ; un régime inconnu ou un rayon inconnu lève une erreur qui nomme la recette.
- [ ] Implémenter : script autonome (pas d'alias `@/`), SHA-1 de `"popote-catalogue:" + titre normalisé`, octets de version/variante v5 ; une instruction par recette : `with r as (insert into public.recipes (…) values (…) on conflict (id) do nothing returning id) insert into public.recipe_ingredients (…) select r.id, … from r cross join (values …) as i (…)`. En-tête : fichier généré, commande pour le régénérer. `main` seulement si `import.meta.main`.
- [ ] Générer `0007_basics_catalog.sql`, `supabase db reset`.
- [ ] pgTAP `catalog.test.sql` : 75 recettes au catalogue, 40 aux identifiants `ca7a…` ; 35 basiques, toutes avec une base ; 16 basiques céto ; chaque base de basique a au moins une recette céto et une non céto ; les tests de régimes existants passent sur l'ensemble.
- [ ] README : section « Importer un lot de recettes » (nouvelle migration par lot). Commit.

### Task 3 : logique pure (bases, filtres, formulaire, planificateur)

**Files:**
- Create: `lib/bases.ts`, `lib/bases.test.ts`
- Modify: `lib/recipes.ts`, `lib/recipes.test.ts`, `lib/planner.ts`, `lib/planner.test.ts`

**Produces (lib/bases.ts):**
- `sameBase(a: string | null, b: string | null): boolean` (deux bases non vides, `normalizeText` égaux)
- `singularize(name: string): string` : mots avant la première préposition (`de`, `d'…`, `du`, `des`, `à`, `au`, `aux`, `en`, `pour`, `avec`, `sans`) ; `-eaux`/`-eux` → sans `x` ; `-s` retiré si mot > 3 lettres, sans `ss` final, hors invariables (`travers`, `noix`, `pois`, `dos`, `gras`, `anchois`, `radis`, `riz`, `jus`, `frais`).
- `suggestBase(ingredients: readonly { name: string; aisle: GroceryAisle }[], knownBases: readonly string[]): string | null` : premier ingrédient boucherie/poissonnerie ; base connue la plus longue contenue (mots entiers, après singulier et `normalizeText`) ; sinon `singularize(name)`.
- `uniqueBases(bases: readonly (string | null)[]): string[]` : une par base normalisée, première orthographe, tri `fr`.
- `sideLabel(title: string, base: string | null): string` : « Steak haché et frites » → « frites » (titre = base + `et` / `avec` / virgule) ; sinon le titre.
- `basicRows<T extends { title: string; base: string | null; diets: readonly Diet[] }>(recipes: readonly T[], firstBase?: string | null): { base: string; recipes: T[] }[]` : groupe par base normalisée (libellé = première orthographe), lignes triées `fr`, `firstBase` en tête, recettes sans base dans une ligne « Autres » en dernier ; dans une ligne, non céto puis céto, chacune par `sideLabel`.
- `recipePartners<T extends { id: string; title: string; base: string | null; diets: readonly Diet[] }>(recipe: T, visible: readonly T[]): T[]` : même base, sans elle-même ; céto contraire d'abord, puis titre.

**Modifie lib/recipes.ts:** `RecipeInput` + `base: string | null`, `basic: boolean` ; `parseRecipeForm` lit `base` (erreur `base` : « Cet élément principal est trop long (60 caractères au plus). ») et `basic` (`"on"`) ; `RecipeFilters.basic`, `FilterableRecipe.basic`, adresse `basiques=1`.
**Modifie lib/planner.ts:** `PlannerRecipe.basic?: boolean` ; candidats sans basiques dans `proposeWeek` et `nextIdea` (la carte verrouillée sur une basique reste dans `week.recipes`).

- [ ] Tests d'abord pour chaque fonction (cas du Review Focus inclus), les voir échouer, implémenter, `docker compose exec web npm test` vert. Commit.

### Task 4 : données et formulaire de recette

**Files:**
- Modify: `lib/recipes-data.ts`, `app/(app)/recettes/recipe-form.tsx`, `app/(app)/recettes/recipe-form.test.tsx`, `app/(app)/recettes/[id]/modifier/page.tsx`, `app/(app)/recettes/nouvelle/page.tsx`

**Produces:** `ListRecipe.base: string | null`, `ListRecipe.basic: boolean` ; `loadRecipeForm()` renvoie aussi `bases: string[]` ; `loadRecipe()` renvoie aussi `partners: { id; title; diets }[]`.

- [ ] Tests composant : nouvelle recette, choisir l'ingrédient connu « Blancs de poulet » (rayon boucherie) avec la base connue « Poulet » → champ « Élément principal » = « Poulet » ; ingrédient « Pavés de bœuf » sans base connue → « Pavé de bœuf » ; après avoir tapé dans le champ, changer d'ingrédient ne le modifie plus ; recette existante → valeur enregistrée, aucun pré-remplissage ; l'interrupteur « Recette basique » envoie `basic=on`.
- [ ] Champ `Autocomplete` (options = `bases`) dans « L'essentiel » sous le titre, `name="base"`, aide de la spec ; valeur affichée = saisie si touché ou recette existante, sinon `suggestBase(rows, bases)`. `SwitchField` « Recette basique » dans « Régimes et préparation ». Tests verts, commit.

### Task 5 : fiche « Se marie avec », filtre « Basiques »

**Files:**
- Create: `components/recipe-chip.tsx`
- Modify: `components/choice-chip.tsx` (cadre partagé `CHIP_FRAME`), `app/(app)/recettes/[id]/page.tsx`, `app/(app)/recettes/recipe-browser.tsx`, `components/recipe-components.test.tsx`

**Produces:** `RecipeChip({ label, keto, href?, onClick?, className? })` : lien si `href`, bouton si `onClick`, sinon simple pastille (glissable).

- [ ] Tests : `RecipeChip` rend un lien / un bouton / ni l'un ni l'autre, avec la pastille « Céto » si `keto`.
- [ ] Fiche : ligne « Se marie avec » sous les pastilles, si `partners` non vide (`ChoiceRow`-like : défile sur téléphone, passe à la ligne sur ordinateur). `/recettes` : puce « Basiques » dans « Autres filtres ». Commit.

### Task 6 : « Les basiques » dans la Bibliothèque

**Files:**
- Modify: `components/recipe-library.tsx`, `app/(app)/semaine/week-board.tsx`, `components/week-components.test.tsx`

**Produces:** prop `RecipeLibrary.firstBase?: string | null`.

- [ ] Tests : la section « Les basiques » liste une ligne par base et ses puces ; la liste du dessous n'a pas les basiques ; la recherche filtre aussi les puces ; avec `eaters` = un membre céto, seules les puces céto restent ; `firstBase` met sa ligne en tête ; toucher une puce appelle `onPick` avec la recette ; avec `renderItem`, chaque puce est enveloppée.
- [ ] Implémenter. Le compteur dit le nombre de recettes montrées (puces + liste). `week-board` passe `firstBase` = première base parmi les cartes du même jour et repas. Commit.

### Task 7 : /design, CLAUDE.md, e2e, captures, build, PR

- [ ] `/design` : `RecipeChip`, la section « Les basiques » dans la démo de la Bibliothèque, la ligne « Se marie avec ».
- [ ] CLAUDE.md, ligne `recipes` : la phrase exacte demandée.
- [ ] e2e : compteurs recalés (catalogue 75), `docker compose run --rm e2e` vert.
- [ ] Captures Pixel 7 et 1440×900 : formulaire, fiche, /recettes filtrée, panneau « Choisir » (Marie-Laure), tiroir.
- [ ] `npm run lint`, `npm run build`, commit final (liste des bases remplies dans le message), push, `gh pr create`.
