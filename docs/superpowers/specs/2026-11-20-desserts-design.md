# Desserts, fruits, fromages : autant qu'on veut par repas : design

Validé le 2026-11-20 (« go »). Complète CLAUDE.md et la charte de `/design`. Source : le prompt
A/B/C de l'utilisateur (2026-11-20), ses réponses ci-dessous, et les choix de Claude marqués
*(choix)*. La partie C (historique et notes) attend que l'historique soit dans `main` : pas de
`meal_history` à ce jour.

## Intention

À chaque repas, on ajoute en deux touches autant de desserts, fruits, fromages, laitages ou
entrées qu'on veut, chacun pour qui en mange. Ce sont des recettes comme les autres (souvent d'un
seul ingrédient : « Yaourt nature » = 1 yaourt par personne) : elles comptent dans la liste de
courses et le frigo sans rien inventer. Usage réel : le lundi, « Yaourt nature » à tous les dîners
en une fois, des fruits au pique-nique du mercredi, du fromage pour Marie-Laure ; dans la semaine,
un dessert un soir en deux touches.

## Objectifs

- **A** (code pur et base) : migration `0015_meal_courses.sql`, catalogue léger
  `0016_light_catalog.sql` généré depuis `recettes-legeres.json`, `lib/recipes.ts`,
  `lib/board.ts`, `lib/planner.ts`, `lib/portions.ts`, `lib/shopping.ts`, `lib/week-data.ts`,
  pgTAP et Vitest.
- **B** (écrans) : puces dans `/semaine`, panneau d'ajout, panneau d'une puce, formulaire de
  recette (sorte, formulaire léger), `/recettes` (filtres, étiquette, fiche compacte), `/design`,
  CLAUDE.md, e2e, captures, PR.

## Non-objectifs

- La proposition automatique ne propose jamais de plat léger (l'IA le fera plus tard).
- Pas de verrou, d'« Autre idée » ni de glisser-déposer sur les puces.
- Rien à coder pour `/courses` et `/frigo` (vérification à l'écran seulement).
- Partie C (historique) : plus tard.

## Anti-objectifs

- Servir d'office à quelqu'un un plat léger que son régime refuse (Marie-Laure, céto, n'a jamais
  la pomme sans le demander).
- Qu'un yaourt « nourrisse » un repas : un repas avec seulement un yaourt reste à remplir.
- Que « Relancer » efface un plat léger.

## Règles

- **Sorte** : `recipes.course` (`public.course`) : `main` (Plat, défaut), `starter` (Entrée),
  `dessert`, `fruit`, `cheese` (Fromage), `dairy` (Laitage). « Plat léger » = tout ce qui n'est
  pas `main` (`isExtra(course)`).
- **Un seul plat par personne et par repas** ne vaut que pour les `main`. Plats légers
  illimités ; une même recette légère une seule fois par repas (on fusionne les mangeurs).
- **Recette légère** : un ingrédient, `servings = 1`, pas d'étapes.
- **Portions** : `dessert`, `fruit`, `cheese`, `dairy` : un mangeur = une portion, sans
  coefficient (`UNSCALED_COURSES`, `lib/portions.ts`). Entrée et plat gardent les coefficients.
- **Proposition automatique** : ignore les plats légers (ni proposés, ni supprimés, ni servis, ni
  comptés pour plafonds, bases, protéines, « Autre idée »).
- **Céto** : dans un ajout, chaque recette va aux personnes choisies qui peuvent la manger
  (`canEat` : régimes et exclusions). On peut toujours rajouter quelqu'un à la main ensuite
  (signalé par `eaters-picker`).

## Approche

Une seule voie sensée : la sorte est une colonne de la recette, et chaque endroit qui applique
« un plat par personne » ne regarde que les cartes dont la recette est un plat. Les autres
pistes (table à part pour les plats légers, drapeau sur la carte) dupliqueraient courses, frigo
et bilan, que les recettes servent déjà.

## A : données et calcul

### Migration `0015_meal_courses.sql`

- Type `public.course` et `recipes.course not null default 'main'`. Contrainte *(choix)* :
  `course = 'main' or (base is null and not basic)`. Pas d'index *(choix : les recettes d'un
  foyer sont chargées en entier)*.
- `save_recipe` et `copy_recipe` redéfinies depuis leur dernière version (`0006` pour
  `save_recipe`, `0009` pour `copy_recipe`), avec `course` ; `save_recipe` met `base` à null et
  `basic` à false hors plat.
- `private.is_main_recipe(recipe_id)` (ou jointure) : une carte est un plat si sa recette est
  `main`.
- `set_planned_meal_eaters` : sur un plat, l'exclusivité ne touche que les autres plats du repas ;
  sur une carte légère, on pose les mangeurs sans toucher ni aux autres cartes ni au verrou.
- `add_planned_meal` : exclusivité entre plats seulement ; refuse une recette légère
  (`check_violation`) *(choix : tout ajout léger passe par `add_planned_extras`)*.
- `add_planned_extras(target_household_id, target_week_start, items jsonb)` :
  `items = [{day, meal_type, recipe_id, member_ids}]`. Crée la semaine au besoin, refuse une
  recette `main` (`check_violation`), fusionne (union, dans l'ordre) sur une recette déjà au
  repas, sinon insère après les cartes du repas, non verrouillée *(choix)*. Une transaction,
  `security invoker`, contrôle `is_household_member`. Rend les cartes créées ou modifiées.
- `save_week_proposal` : ne supprime que les plats non verrouillés ; refuse une carte proposée
  qui n'est pas un plat.
- `swap_planned_meals` : refuse (P0001) une carte légère.
- Pas de contrainte d'unicité en base pour « une recette légère par repas » *(choix)*.
- Référentiel commun : 172 « Yaourt à la grecque » (crèmerie, `g`, alias « yaourt grec »,
  « yaourt grec nature », 14 jours) et 173 « Fromage de chèvre » (crèmerie, `piece`, 180 g,
  alias « bûche de chèvre », « chèvre », 10 jours) *(choix des durées)*. `piece_grams` : Comté
  250, Emmental 250, Camembert 250, Fromage blanc 500, Chocolat noir 100, Raisin 500, Fraises 250.
- pgTAP : RLS inchangée ; plat ↔ yaourt indépendants ; un membre sur un plat et trois plats
  légers ; fusion et refus d'un `main` dans `add_planned_extras` ; `save_week_proposal` garde
  les plats légers non verrouillés ; `swap_planned_meals` refuse une carte légère ;
  `add_planned_meal` refuse une recette légère.

### Catalogue léger `0016_light_catalog.sql`

`scripts/json-to-catalogue.ts` lit `plat` (`entree` → `starter`, `laitage` → `dairy`, `fruit`,
`fromage` → `cheese`, `dessert` ; absent = `main`), écrit `course`. Migration générée, rejouable,
identifiants fixes. Régimes du fichier gardés tels quels.

### Code pur

- `lib/recipes.ts` : `Course`, `COURSES` (valeur, libellé, icône lucide : Plat `Utensils`,
  Entrée `Salad`, Dessert `CakeSlice`, Fruit `Apple`, Fromage `Cheese`, Laitage `Milk`),
  `isExtra`, `parseRecipeForm` lit `course` (hors plat : `base` null, `basic` false).
- `lib/board.ts` : `buildBoard` rend par créneau `cards` (plats), `starters`, `extras` (Laitage,
  Fruit, Fromage, Dessert, puis position) ; `unfed` ne compte que les plats. `moveEaters` :
  exclusivité entre plats seulement ; carte légère : mangeurs posés seuls. `menuBase` ne regarde
  que les plats. `extrasToAdd({ recipes, eaterIds, target, slots, cards, members })` : `target` =
  un repas, ou tous les repas de ce type à partir de `fromDay` ; mangeurs = choisis ∩ présents ∩
  `canEat` ; fusion si déjà là ; rend les éléments à envoyer et, par repas, les choisis restés
  sans plat léger compatible.
- `lib/planner.ts` : `PlannerRecipe.course?` (défaut `main`) ; `proposeWeek` et `nextIdea`
  ignorent recettes et cartes non-plats.
- `lib/week-data.ts` : `loadWeek` rend `recipes` (plats seulement : planner, Bibliothèque) et
  `extraRecipes` (le reste : puces, panneau d'ajout) *(choix)*.
- `lib/portions.ts` : `UNSCALED_COURSES`, et la mise à l'échelle par sorte.
- `lib/shopping.ts` : `ShoppingRecipe.course` (la sorte vit sur la recette ; pas de copie sur
  `ShoppingMeal`, *choix*) ; `accumulate` (donc `weekNeeds` et la liste) applique la règle.
  `lib/menu-recipes.ts` charge `course`.

## B : écrans

### Grille `/semaine`

- Entrées en puces au-dessus des plats, desserts/fruits/fromages/laitages en puces dessous :
  icône de la sorte + titre court (tronqué, retour à la ligne), avatars miniatures seulement si
  pas pour tous les présents. « Pas mangé » : puce atténuée *(choix)*.
- Puce discrète « + Dessert, fruit… » après les puces, même sur un repas vide.
- Toucher une puce : panneau avec le titre, « Qui en mange ? » (`eaters-picker`), « Pas mangé »
  (aujourd'hui et jours passés, `skipped`), « Retirer » ; dessert complet ou entrée : lien vers la
  fiche et « Il en reste ».
- Échanger deux plats : les plats légers restent au repas (déjà le cas : seules les recettes des
  deux plats s'échangent).
- « Proposer la semaine » / « Relancer » selon qu'il y a des plats *(choix)*.

### Panneau d'ajout

- Titre « Pour finir le dîner de lundi ». « Pour qui ? » pré-coché : tous les présents.
- `choice-chip` Laitage · Fruit · Fromage · Dessert · Entrée (Laitage d'abord, puis la dernière
  sorte utilisée pendant la visite, *choix*) et recherche (sur toutes les sortes, *choix*).
  Tuiles à cocher (plusieurs), recettes du type de repas *(choix)*, foyer + catalogue, favoris
  d'abord, pastille Keto.
- **Déjà au repas** (réponse) : cochée, figée, mention « Déjà là » ; le panneau ne fait
  qu'ajouter. Retirer ou changer qui en mange : depuis sa puce.
- **Frigo** *(choix)* : recette légère dont l'ingrédient est en stock libre, ou dessert/entrée
  dont un reste est au frigo : « Au frigo » (« À finir » si `fridgeStatus` = `soon`), en tête de
  sa sorte.
- Puces « Ce repas » · « Tous les dîners de la semaine » (libellé selon le repas). **Jours
  visés** (réponse) : à partir d'aujourd'hui dans la semaine en cours, les 7 sinon ; même type
  de repas exactement (un midi ne vise pas le pique-nique).
- Bouton « Ajouter 2 » / « Ajouter à 7 dîners ».
- **Céto** : une ligne « Et pour Marie-Laure ? » par présent coché resté sans plat léger
  compatible, avec en puces les plats légers qui lui vont (même sorte, sinon toutes), favoris
  d'abord ; une touche l'ajoute pour lui ou elle seul(e) sur les mêmes repas ; « Rien pour
  elle » / « Rien pour lui » ferme.
- **Créer à la volée** (recherche sans résultat) : tuile « Créer « Clafoutis » » → sorte
  (devinée par le rayon de l'ingrédient s'il est au référentiel : fruits et légumes → Fruit,
  crèmerie → Laitage). Fruit, Fromage, Laitage : portion « 1 pièce » modifiable ; rayon du
  référentiel, sinon d'après la sorte ; tous les types de repas ; régimes **devinés** (réponse) :
  ceux d'une recette légère du catalogue au même ingrédient, sinon Fruit → végétarien, sans
  gluten, sans lactose ; Laitage → végétarien, sans gluten ; Fromage → végétarien, sans gluten,
  céto ; à confirmer d'une touche. Dessert, Entrée : titre seulement, 4 personnes, tous les types
  de repas, aucun régime *(choix)* ; **après « Ajouter », le toast propose « Compléter la
  recette »** (réponse). La recette créée est cochée.
- Toast (« Ajouté à 7 dîners »), mise à jour optimiste, Server Actions dans
  `app/(app)/semaine/actions.ts`.

### Autres écrans

- Bibliothèque des plats : uniquement les plats.
- Formulaire : « C'est… » (Plat · Entrée · Dessert · Fruit · Fromage · Laitage). Fruit, Fromage,
  Laitage : formulaire léger (titre, « Une portion, c'est » quantité + unité + ingrédient, titre
  ↔ ingrédient pré-remplis, régimes, types de repas tous cochés, exclus), lien « Plus de
  détails ». Une recette de ces sortes qui n'a pas la forme légère s'ouvre en formulaire complet
  *(choix)*. Entrée, Dessert : formulaire complet sans « Élément principal » ni « Recette
  basique ».
- `/recettes` : rangée « Sorte » *(choix)* avec « Entrées » (`?sorte=entree`) et « Desserts,
  fruits, fromages » (`?sorte=fin`), cumulables ; étiquette de sorte sur les cartes hors plat ;
  fiche légère compacte (pas d'étapes vides, pas de « Se marie avec »).
- `/design` : section « Desserts et compagnie ».
- CLAUDE.md : lignes `recipes`, `planned_meals`, `shopping_lists`.
- e2e : proposer ; Yaourt nature + Pomme à tous les dîners ; « Et pour Marie-Laure ? » → Comté ;
  Clémentines au pique-nique du mercredi ; « Relancer » garde les puces ; `/courses` : 35
  Yaourts nature, 28 Pommes (plus celles des plats proposés, s'il y en a) ; retirer une puce.

## Laissé au constructeur

Noms internes, découpage des composants, textes secondaires (aides, messages d'erreur) dans le
ton de l'appli.
