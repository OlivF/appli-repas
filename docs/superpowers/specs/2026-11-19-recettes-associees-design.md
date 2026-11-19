# Recettes associées et basiques : design

Validé le 2026-11-19 (« go »). Complète CLAUDE.md et la charte de `/design`.

## Intention

Marie-Laure mange cétogène, le reste de la famille non. On ne veut pas cuisiner deux repas, mais
deux recettes qui s'associent : même élément principal, accompagnement différent (steak haché +
haricots verts pour elle, steak haché + frites pour les autres). Une seule cuisson.

Deux notions arrivent :

- `recipes.base` : l'élément principal du plat (« Steak haché », « Poulet »…). Deux recettes de
  même base (comparées avec `normalizeText`) s'associent.
- `recipes.basic` : la recette fait partie du panneau « Les basiques », un choix rapide dans la
  Bibliothèque de `/semaine`.

## Objectifs

1. Migration `0006_recipe_base_basic.sql` : colonnes, `save_recipe` et `copy_recipe` redéfinies,
   bases des recettes évidentes du catalogue 0003.
2. Import des 35 basiques (`recettes-basiques.json`) par `scripts/json-to-catalogue.ts`, qui écrit
   la migration `0007_basics_catalog.sql`.
3. Formulaire : champ « Élément principal » (autocomplétion, pré-remplissage) et interrupteur
   « Recette basique ».
4. Fiche : ligne « Se marie avec ».
5. `/recettes` : puce de filtre « Basiques ».
6. Bibliothèque (tiroir et panneau « Choisir / Changer ») : section « Les basiques » en tête.
7. CLAUDE.md, tests pgTAP, Vitest, e2e existants recalés, captures, build, commit, PR.

## Hors champ

- La proposition auto ne cherche pas à associer les plats par base (plat à part de même base) :
  ce sera peut-être une étape suivante.
- Le lot keto (`recettes-keto.json`) n'est pas dans le dépôt : il n'est pas importé, et seules les
  recettes de 0003 reçoivent une base.

## À éviter absolument

- Un style fait à la main : tout passe par les composants de `/design` (nouveau composant
  `RecipeChip` ajouté à la page).
- Des basiques qui envahissent les semaines proposées.
- Toucher aux régimes du fichier JSON : ils ont été vérifiés (frites non marquées sans gluten exprès).

## Décisions de l'utilisateur

| Sujet | Choix |
| --- | --- |
| Livraison des basiques | Une migration générée (`0007_basics_catalog.sql`), pas un `supabase/catalogue.sql` : elle part en prod avec `supabase db push`. Un futur lot = une nouvelle migration |
| Proposition auto | Les recettes `basic` sont exclues de « Proposer la semaine » et « Une autre idée » (on les pioche à la main) |
| Rangement dans la Bibliothèque | Section « Les basiques » en tête, puis la liste des autres recettes, sans les basiques. Recherche et filtres s'appliquent aux deux |
| Panneau pour une partie de la table | Une puce est cachée si personne à table ne peut la manger ; la ligne de la base déjà au menu de ce repas passe en premier |
| Le reste | Proposé par Claude (ci-dessous) et validé tel quel (« go ») |

## Approches envisagées

1. **Base en texte libre sur la recette, association calculée côté TypeScript** (retenue) : une
   colonne, `normalizeText` pour comparer, aucun lien à maintenir. Les recettes visibles (catalogue
   + foyer) sont déjà toutes chargées pour la liste et la semaine.
2. Table `bases` avec clé étrangère : orthographe unique garantie, mais un écran de plus à gérer
   et une migration lourde pour une liste qui reste petite.
3. Liens explicites recette ↔ recette : précis, mais chaque nouvelle recette demanderait de
   cocher ses partenaires à la main.

## Choix de Claude, validés

### Base de données

- `base text check (base is null or char_length(btrim(base)) between 1 and 60)` ; `save_recipe`
  enregistre `nullif(btrim(base), '')`. `basic boolean not null default false`.
- `copy_recipe` recopie `base` et `basic`, et garde le passage des cartes de la semaine (0005).
- Bases de 0003 : n°15 « Poulet rôti et pommes de terre » et n°21 « Poulet à la crème et aux
  champignons » → Poulet ; n°22 « Saumon au four, beurre citronné et brocolis » → Saumon. Laissées
  vides : salades, wraps et taboulé au poulet (27, 30, 33 : midis à emporter, pas la même
  cuisson), saumon fumé (32), boulettes (23). Les copies déjà faites de ces trois recettes
  reçoivent la même base.
- Script `node scripts/json-to-catalogue.ts <fichier.json> <migration.sql>` (Node 26 lance le
  TypeScript directement) : identifiant UUID dérivé du titre normalisé (SHA-1, format v5),
  `on conflict (id) do nothing`, ingrédients insérés seulement avec leur recette (rejouable).
  Régimes : `keto`, `vegetarien` → `vegetarian`, `sans_gluten` → `gluten_free`, `sans_lactose` →
  `lactose_free`. `accompagnement` n'est pas stocké. `recettes-basiques.json` est committé.

### Formulaire

- « Élément principal » sous le titre, avec l'aide « Deux recettes avec le même élément principal
  se cuisinent ensemble. » et l'autocomplétion sur les bases connues (foyer + catalogue).
- Pré-remplissage pour une nouvelle recette seulement, tant que le champ n'a pas été touché : premier
  ingrédient du rayon boucherie ou poissonnerie ; une base connue contenue dans son nom d'abord
  (la plus longue : « Steaks hachés pur bœuf » → « Steak haché », « Blancs de poulet » →
  « Poulet ») ; sinon le nom au singulier (« Pavés de bœuf » → « Pavé de bœuf »).
- Interrupteur « Recette basique », aide « Elle apparaît dans Les basiques de la semaine. »

### Fiche

- Ligne « Se marie avec » sous les pastilles : puces-liens au titre complet, pastille Céto sur les
  recettes cétogènes ; celles dont le caractère céto diffère de la recette affichée d'abord, puis
  ordre alphabétique. Une ligne qui défile sur téléphone, qui passe à la ligne sur ordinateur
  (comme les filtres).

### Bibliothèque

- Une ligne par base (libellé de la base, puis ses puces). Libellé d'une puce : l'accompagnement
  tiré du titre (« Steak haché et frites » → « frites », quand le titre commence par la base suivie
  de « et », « , » ou « avec ») ; sinon le titre complet.
- Panneau « Choisir / Changer » : toucher une puce pose la recette. Tiroir ordinateur : les puces
  se glissent vers la grille, comme les lignes de recette.
- Les recettes du foyer marquées basiques sont, elles aussi, hors proposition auto.

## Ce qui reste au builder

Les détails de mise en page à l'intérieur des composants existants, les noms des fonctions, le
choix des icônes lucide.
