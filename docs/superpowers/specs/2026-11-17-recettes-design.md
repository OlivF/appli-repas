# Étape 2, partie recettes — design

Validé le 2026-11-17. Complète CLAUDE.md (feuille de route, étape 2).

## Intention

Chaque foyer range ses recettes et pioche dans un catalogue commun de recettes françaises
du quotidien. Ces recettes nourriront ensuite la proposition automatique de la semaine
(grille, prochaine partie de l'étape 2) et la liste de courses (étape 3). Il faut donc savoir,
pour chaque recette et chaque membre, s'il peut en manger, et pouvoir recalculer les quantités.

## Objectifs

- `/recettes` : grille de cartes, recherche instantanée, filtres en puces.
- Fiche recette : quantités recalculées selon le nombre de personnes, étapes, notes batch.
- Formulaire d'ajout et de modification en une seule page.
- Catalogue commun (~40 recettes) lisible par tous, modifiable par personne, copiable.

## Hors champ

- Proposition automatique, grille de la semaine, glisser-déposer (suite de l'étape 2).
- Coefficients d'appétit et d'âge (servent à la liste de courses, étape 3).
- Envoi de photos : une photo est une adresse web.
- Restyler l'accueil et le parcours `/bienvenue`.

## À éviter absolument

- Un compte qui voit ou modifie les recettes, favoris ou exclusions d'un autre foyer.
- Le compte de test (`seed.sql`) poussé en production.
- Une recette enregistrée à moitié (sans ses ingrédients).
- Un style fait à la main : tout passe par les composants de `/design`.

## Décisions de l'utilisateur

| Sujet | Choix |
| --- | --- |
| Catalogue | Migration dédiée `0003_recipe_catalog.sql` (part en prod avec `supabase db push`) ; `seed.sql` garde le foyer de test |
| Favori, membres exclus | Rangés à part, par foyer ; marchent sur le catalogue sans copie |
| Avatars barrés | Exclus à la main **et** membres dont le régime n'est pas compatible |
| Composants manquants | Ajoutés au design system et montrés sur `/design` avant usage |
| Navigation | Barre d'onglets du design dès maintenant |
| Copie d'une recette du catalogue | La copie remplace l'originale dans la liste du foyer |
| Commits | Design system existant d'abord (fait : `ace3e77`), puis les recettes |

## Approches envisagées

1. **Server Actions + fonctions SQL `save_recipe` / `copy_recipe`** (retenue) : une recette,
   ses ingrédients et ses exclus s'écrivent en une transaction ; la RLS s'applique
   (`security invoker`).
2. Server Actions + plusieurs appels PostgREST (recette, puis suppression et réinsertion des
   ingrédients) : plus court, mais une coupure au milieu laisse une recette sans ingrédients.
3. Route API dédiée : contraire à CLAUDE.md (pas d'autre backend).

## Base de données

### `0002_recipes.sql`

Enums : `ingredient_unit` (`g`, `kg`, `ml`, `l`, `piece`, `cas`, `cac`) ;
`grocery_aisle` (`fruits_legumes`, `boucherie`, `poissonnerie`, `cremerie`, `epicerie`,
`surgeles`, `boulangerie`, `boissons`, `autre`). Les régimes réutilisent l'enum `diet`
existant (`keto`, `vegetarian`, `gluten_free`, `lactose_free`), les repas l'enum `meal_type`.

`recipes`
- `household_id` (null = catalogue), `source_recipe_id` (l'originale d'une copie,
  `on delete set null`), unique par (foyer, originale).
- `title` (1–120), `description` (≤ 300, facultative), `photo_url` (http(s), facultative).
- `meal_types meal_type[]` (au moins un), `servings` (1–50), `prep_minutes`, `cook_minutes`
  (0–1440), `diets diet[]`, `steps text[]`.
- `batch_friendly`, `batch_notes` (facultative), `kid_friendly`.

`recipe_ingredients` : `recipe_id`, `household_id` (recopié de la recette par trigger,
null pour le catalogue), `position`, `name` (1–80), `quantity` (> 0) et `unit`, facultatifs
ensemble (« sel, poivre »), `aisle` (défaut `autre`).

`recipe_favorites (household_id, recipe_id)` et
`recipe_member_exclusions (household_id, recipe_id, member_id)` : un trigger vérifie que la
recette est au catalogue ou au foyer, et que le membre est du foyer.

RLS : lecture des recettes et ingrédients si `household_id is null` ou membre du foyer ;
écriture seulement si membre du foyer (donc jamais sur le catalogue). Favoris et exclus :
par foyer. Aucun accès anonyme.

Fonctions (`security invoker`, la RLS s'applique) :
- `save_recipe(target_household_id, recipe_id, recipe jsonb, ingredients jsonb,
  excluded_member_ids uuid[])` → id : crée ou met à jour, remplace ingrédients et exclus.
- `copy_recipe(source_recipe_id, target_household_id)` → id : copie une recette du
  catalogue (ou rend la copie existante), y déplace favori et exclus du foyer.

Vue `known_ingredients` (`security_invoker`) : un nom par ingrédient connu (catalogue et
recettes du foyer) avec son rayon, celui du foyer d'abord.

### `0003_recipe_catalog.sql`

40 recettes, identifiants fixes `ca7a0000-0000-4000-8000-0000000000NN` : 11 petits-déjeuners
(dont 3 céto), 15 dîners familiaux (dont 6 céto qui plaisent aux enfants), 8 midis céto à
emporter, 6 pique-niques rapides pour enfants. Noms d'ingrédients harmonisés d'une recette à
l'autre (ils alimentent l'autocomplétion et, plus tard, la liste de courses).

### `0004_member_colors.sql`

`members.color` (0–7) : un trigger donne à chaque nouveau membre la première couleur libre
de son foyer ; les membres existants reçoivent la leur dans l'ordre d'ajout. `seed.sql`
donne explicitement 0 à 4 au foyer de test.

## Écrans

Barre d'onglets du design (en bas sur téléphone, sur le côté dès 1024 px) sur l'accueil,
`/recettes` et `/courses`. Semaine = l'accueil actuel, Foyer = `/bienvenue/membres`,
Courses = état vide « La liste de courses arrive bientôt ».

### `/recettes`

- En-tête « Recettes » et bouton « Ajouter ».
- Recherche sur le titre et les noms d'ingrédients, sans accents ni majuscules.
- Puces : repas (en « ou »), régimes (en « et »), « À l'avance », « Favoris ». Recherche et
  filtres vivent dans l'adresse (le retour depuis une fiche les retrouve).
- Recettes du foyer et du catalogue mêlées, tri alphabétique ; une recette du catalogue
  copiée par le foyer n'apparaît plus (sa copie la remplace).
- Carte : photo ou emoji du repas, repas, temps total, pastilles régimes et « À l'avance »,
  cœur si favori, avatars de tous les membres, barrés pour ceux qui n'en mangent pas,
  avec « Pour tout le monde » / « Sauf Marie-Laure ».

### Fiche `/recettes/[id]`

- Couverture, titre, description, repas, temps de préparation et de cuisson, pastilles
  (régimes, « À l'avance », « Plaît aux enfants »), bouton cœur.
- « Qui en mange ? » : avatars cliquables (exclusion enregistrée aussitôt, catalogue compris) ;
  les membres écartés par leur régime sont barrés, non cliquables, avec la raison.
- Ingrédients : curseur de 1 à 12 personnes, réglé au départ sur le nombre de membres ;
  règle de trois depuis les portions de base ; nom à gauche, quantité à droite.
  Arrondis : g et ml à l'unité sous 20, au 5 sous 200, au 10 au-delà ; kg et l au 0,05 ;
  pièces et cuillères au ½ (½, 1 ½…).
- Étapes numérotées ; notes « Le dimanche » si la recette se prépare à l'avance.
- Recette du foyer : « Modifier ». Recette du catalogue : « Copier dans mes recettes », qui
  ouvre le formulaire de la copie. Une recette du catalogue déjà copiée renvoie à la copie.

### Formulaire `/recettes/nouvelle` et `/recettes/[id]/modifier`

Titre, description, photo, repas (puces), portions / préparation / cuisson, régimes
(puces), « Se prépare à l'avance » (interrupteur, ouvre « Ce qu'on fait le dimanche »),
« Plaît aux enfants », ingrédients ligne par ligne (nom avec autocomplétion qui remplit le
rayon, quantité, unité, rayon, supprimer), étapes (une par ligne), « Qui n'en mange pas ? »
(avatars cliquables ; ceux qu'écarte un régime coché sont barrés d'office), Enregistrer.
En modification : « Supprimer la recette », confirmé par une seconde touche.
Le favori se règle sur la fiche.

## Nouvelles pièces du design system (montrées sur `/design`)

Curseur (radix Slider), zone de texte, liste de choix (`<select>` natif habillé comme les
champs), autocomplétion (combobox ARIA), champ de recherche, avatar barré et avatar
cliquable, pastille « Plaît aux enfants », bouton cœur, liste d'ingrédients.
`RecipeCard` : plusieurs repas, membres barrés, favori, lien vers la fiche.

## Tests

- Vitest : lecture du formulaire, quantités et arrondis, durée, recherche et filtres,
  qui peut manger quoi.
- pgTAP : catalogue lisible et non modifiable, recettes, ingrédients, favoris et exclus
  cloisonnés par foyer, `save_recipe`, `copy_recipe`, couleurs des membres.
- Playwright (téléphone) : chercher et filtrer, ouvrir une fiche et changer le nombre de
  personnes, copier une recette du catalogue, créer une recette avec l'autocomplétion.
- Captures téléphone (Pixel 7) et ordinateur (1440 px) de la grille, de la fiche et du
  formulaire, plus un contrôle en mode sombre ; `npm run build`.

## Laissé à l'implémentation

Noms exacts des composants et des fichiers, découpage client/serveur, textes d'aide,
contenu détaillé des 40 recettes.
