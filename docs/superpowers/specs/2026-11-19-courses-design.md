# Étape 3 : référentiel d'ingrédients, calcul et écran des courses : design

Validé le 2026-11-19 (« go »). Complète CLAUDE.md, la charte de `/design` et les specs de la semaine
(`2026-11-17-semaine-design.md`, `2026-11-19-plusieurs-plats-design.md`). Source : le prompt A/B/C
de l'utilisateur (2026-11-19), ses réponses ci-dessous, et les choix de Claude marqués *(choix)*.

## Intention

Le lundi, on prépare le menu de la semaine suivante ; le jeudi, au téléphone, on remplit le panier
du drive en suivant la liste et en cochant au fur et à mesure, d'une main, vite, sans réfléchir.
Marie-Laure voit la même liste depuis son compte. Pour additionner les quantités de la semaine, il
faut savoir que deux lignes de recettes parlent du même produit : d'où un référentiel d'ingrédients
commun, qui servira ensuite au frigo (« Dans le frigo ») et au menu par IA.

## Objectifs

- **A** : référentiel `ingredients` (commun + foyer), `recipe_ingredients.ingredient_id`, rattachement
  automatique, catalogue rempli et fusionné, ~60 produits courants, autocomplétion du formulaire.
- **B** : calcul pur de la liste (`lib/portions.ts`, `lib/shopping.ts`), testé avec Vitest.
- **C** : tables `shopping_lists` / `shopping_items`, génération et mise à jour, écran `/courses`,
  bouton « Faire les courses » sur `/semaine`, section `/design`, e2e, captures, PR.

## Non-objectifs

- Rien du frigo, à part les colonnes prévues (`shelf_life_days`, `removed`, paramètre `stock`).
- Pas de temps réel entre deux téléphones : la liste se recharge à l'ouverture.
- Pas d'invitation d'un second compte (réponse de l'utilisateur : hors champ, noté). La liste est
  par foyer ; un test pgTAP vérifie qu'un second compte du même foyer voit la même liste.
- Le formulaire de recette ne change pas, à part l'autocomplétion qui lit le référentiel.

## Anti-objectifs

- Une mise à jour automatique de la liste pendant qu'on fait ses courses.
- Une quantité inventée quand une conversion manque.
- Une case cochée perdue à la mise à jour (sauf quantité augmentée, volontairement décochée).

## Décisions de l'utilisateur (questions du 2026-11-19)

| Sujet | Choix |
| --- | --- |
| Partage avec Marie-Laure | Hors champ : pas d'invitation dans cette étape ; pgTAP vérifie le partage par foyer |
| Placard | Toucher une ligne : « Il n'en reste plus » → elle passe dans son rayon (sans quantité), compte dans la progression, peut revenir au placard |
| « Ajouter un article » | Barre fixée en bas, au-dessus du menu du bas ; suggestions vers le haut |
| Quantité d'un article manuel | Texte libre (« 2 », « 500 g », « 1 paquet »), affiché tel quel, jamais additionné |
| Rattachement `ingredient_id` | Trigger sur `recipe_ingredients` (plutôt que des appels explicites) |

## Approches envisagées

**Rattachement des lignes au référentiel**

1. *Trigger* (retenue) : `before insert or update of name` sur `recipe_ingredients`, si
   `ingredient_id` est vide → `private.match_ingredient`. Couvre `save_recipe`, le catalogue (0003,
   0007, futurs lots JSON), `seed.sql`, les tests. Moins visible qu'un appel explicite.
2. Appels explicites dans `save_recipe`, `copy_recipe` et le générateur : fidèle à la lettre du
   prompt, mais tout autre chemin d'insertion laisse des lignes hors référentiel.

**Écriture de la liste** : une seule voie raisonnable, retenue. Calcul et fusion en TypeScript
(purs, testés) ; une fonction SQL enregistre le résultat en une transaction. Des appels supabase-js
séparés pourraient perdre des cases cochées sur une coupure au milieu.

## A : référentiel d'ingrédients (`0009_ingredients.sql`)

### Table `ingredients`

| Colonne | Type | Note |
| --- | --- | --- |
| `id` | uuid | |
| `household_id` | uuid null | null = commun (lisible par tous, modifiable par personne) |
| `name` | text | nom affiché dans la liste, au pluriel quand ça se compte (« Oignons », « Œufs ») |
| `name_key` | text, généré | `private.ingredient_key(name)` *(choix)* |
| `aisle` | `grocery_aisle` | |
| `shopping_unit` | enum `shopping_unit` (`g`, `ml`, `piece`) | *(choix : un enum dédié)* |
| `piece_grams` | numeric null | poids moyen d'une pièce |
| `grams_per_ml` | numeric null | densité |
| `aliases` | text[] | autres écritures, déjà normalisées par `ingredient_key` |
| `pantry` | boolean | produit de placard |
| `shelf_life_days` | integer null | non utilisé, servira au frigo |

- Unicité : `unique nulls not distinct (household_id, name_key)` (Postgres 17).
- RLS comme `recipes` : lecture `household_id is null or is_household_member(household_id)`, écriture
  `is_household_member(household_id)` (faux pour null : le commun est intouchable).
- `recipe_ingredients.ingredient_id uuid references ingredients on delete set null`, indexé. Le
  `name` de la ligne reste celui de la recette ; l'ingrédient canonique sert aux courses.

### Normalisation `private.ingredient_key(text)` *(choix)*

Immuable, sans extension (`unaccent` n'est pas immuable, donc inutilisable dans une colonne générée) :
minuscules, `œ`→`oe`, `æ`→`ae`, accents retirés par `translate`, apostrophe typographique → `'`,
espaces repliés, puis chaque mot de plus de 3 lettres perd un `s` ou un `x` final (« pommes de terre »
→ « pomme de terre », « œufs » → « oeuf », « riz » reste « riz »). Les deux côtés passant par la
même fonction, seules des collisions entre produits réellement différents poseraient problème ; il
n'y en a pas dans le catalogue.

### `private.match_ingredient(household uuid, raw_name text, aisle grocery_aisle, unit ingredient_unit) returns uuid`

`security invoker` (la RLS s'applique). Cherche par `name_key` puis par alias, d'abord dans le foyer,
puis dans le commun ; sinon crée un ingrédient du foyer (ou du commun quand `household` est null :
seul le propriétaire de la base, dans une migration, en a le droit) avec ce rayon et une unité
d'achat déduite : `g`/`kg` → `g` ; `ml`/`l`/`cas`/`cac` → `ml` ; `piece` ou sans unité → `piece`
*(choix pour « sans unité »)*. Le nom créé est le texte saisi, rogné. Création concurrente :
`on conflict do nothing` puis relecture.

Découpée en `private.find_ingredient(household, raw_name)` (recherche seule, sert aussi à l'ajout
manuel dans la liste) et la création *(choix)*.

### Rattachement

- Trigger `recipe_ingredients_set_ingredient` (nommé pour passer après `…_set_household`) :
  `before insert or update of name`, si `ingredient_id` est null (ou si le nom a changé) →
  `match_ingredient(new.household_id, new.name, new.aisle, new.unit)`.
- `copy_recipe` redéfinie : recopie l'`ingredient_id` de l'original.
- `save_recipe` inchangée (ses lignes sont réinsérées, le trigger les rattache).
- `scripts/json-to-catalogue.ts` : SQL généré inchangé ; son en-tête dit que le trigger rattache les
  lignes. 0007 n'est pas régénéré.

### Remplissage du commun

- Les 105 noms distincts de 0003 + 0007 (le lot keto n'est pas importé), fusionnés seulement quand
  c'est clairement le même produit. Fusion prévue : « Laitue » → « Salades vertes ». Les autres
  rapprochements (mozzarella / billes de mozzarella, bœuf haché / steaks hachés, pains en tranches)
  restent séparés : ce ne sont pas les mêmes articles au drive. Liste finale dans le commit.
- Nom canonique au pluriel quand l'unité d'achat est la pièce (« Baguettes », « Choux-fleurs »,
  « Yaourts nature ») ; les « Tranches de … » gardent leur nom, pour que « 8 » se lise juste.
- Alias : variantes courantes (« steak haché », « crème fraîche », « filets de poulet »…).
- `grams_per_ml` et `piece_grams` posés quand une conversion réelle du catalogue en a besoin
  (« Crème fraîche épaisse » g + c. à soupe → 1 ; « Graines de chia » g + c. à soupe → 0,8 ; huiles
  0,92, cités par l'utilisateur).
- `pantry` *(choix de la liste)* : sel, poivre, huiles, vinaigres, épices et herbes sèches (cannelle,
  cumin, curry, paprika, herbes de Provence), extrait de vanille, levure chimique, farine, sucre,
  miel, moutarde, mayonnaise.
- ~60 produits courants du drive (pain, beurre, yaourts, fruits de saison, café, thé, céréales,
  biscuits, eau, jus, papier toilette, liquide vaisselle, lessive, éponges, sacs poubelle…), rangés
  dans leur rayon, unité d'achat `piece` sauf évidence.
- Identifiants fixes (`1d9e0000-0000-4000-8000-…`) comme le catalogue *(choix)*.
- Puis rattachement de toutes les lignes existantes (catalogue et foyers) par `match_ingredient`.

### Autocomplétion

`known_ingredients` lit le référentiel : `name`, `aisle`, et `unit` = l'unité la plus utilisée dans
les recettes visibles pour cet ingrédient, sinon l'unité d'achat *(choix : le formulaire pré-remplit
déjà l'unité aujourd'hui, ça ne change pas)*. Un ingrédient du foyer passe avant un ingrédient commun
de même clé.

### Tests

pgTAP : RLS (commun lisible, commun non modifiable, foyer isolé), `ingredient_key`, `match_ingredient`
(nom, alias, pluriel, accents, création côté foyer, création impossible dans le commun pour un
compte), trigger (insertion, renommage, copie), aucune ligne du catalogue sans `ingredient_id`,
`known_ingredients`. Vitest : formulaire si la logique change (a priori non).

## B : calcul (code pur)

### `lib/portions.ts`

- `memberCoefficient(member, weekStart)` : grand appétit → 1,5 ; sinon moins de 12 ans → 0,7 ;
  sinon 1. Seule l'année de naissance est connue : âge = année du lundi − année de naissance
  *(choix imposé par le schéma)*.
- `dishFactor(eaters, recipe, weekStart)` = Σ coefficients ÷ portions de base ; la mise à l'échelle
  réutilise `scaleQuantity` (`lib/recipes.ts`) avec Σ coefficients comme nombre de personnes.

### `lib/shopping.ts`

En tête : `SHOPPING_AISLES` (ordre d'un parcours de drive : fruits et légumes, boucherie,
poissonnerie, crèmerie, boulangerie, épicerie, surgelés, boissons, autre) puis `PANTRY` (« Placard »).
`AISLES` de `lib/recipes.ts` (ordre du menu déroulant du formulaire) ne bouge pas.

`buildShoppingList({ meals, recipes, members, ingredients, weekStart, stock? })` :

1. Pour chaque plat, facteur ; pour chaque ligne avec quantité : quantité × facteur.
2. Conversion vers l'unité d'achat : kg → 1000 g, l → 1000 ml, c. à soupe → 15 ml, c. à café → 5 ml ;
   ml ↔ g par `grams_per_ml` ; pièce ↔ g par `piece_grams` (ml ↔ pièce en passant par les deux).
   Conversion impossible : le morceau reste dans son unité de recette (kg et l repliés en g et ml,
   c. à soupe et c. à café gardées telles quelles), « 200 g + 2 c. à soupe ».
3. Cumul par ingrédient canonique ; `stock` (quantité dans l'unité d'achat, par `ingredient_id`)
   déduit avant l'arrondi ; un article ramené à 0 sans autre morceau disparaît *(choix)*.
4. Arrondi pour l'achat : pièces à l'entier supérieur ; g et ml au 10 supérieur sous 200, au 50
   supérieur à partir de 200 ; c. à soupe et c. à café à l'entier supérieur *(choix)* ; jamais 0.
5. Article : `{ key, ingredientId, label, aisle, pantry, amounts: [{quantity, unit}], sources }`,
   `sources` = `[{ recipeId, recipeTitle, day, mealType, eaters }]` (un par plat).
6. Produits `pantry` : section Placard, sans quantité (« Huile d'olive · pour 5 recettes »). Lignes
   sans ingrédient : au placard, regroupées par nom normalisé. Ligne d'un ingrédient non placard sans
   quantité : l'article garde ses autres quantités, ou s'affiche sans quantité.
7. Tri : rayon dans l'ordre fixe, puis libellé (ordre alphabétique français) *(choix)*.

`formatAmounts(amounts)` : « 1,25 kg » (kg à partir de 1000 g, l à partir de 1000 ml), « 6 »,
« 200 g + 2 c. à soupe », virgule décimale ; ordre : unité d'achat d'abord.

`menuSignature(meals)` : chaque plat → `recette:mangeurs triés`, liste triée, puis empreinte courte
(FNV-1a, hexadécimal) *(choix)* ; indépendante de l'ordre. Ne voit que recettes et mangeurs
(consigne) : déplacer un plat d'un jour à l'autre ou modifier les ingrédients d'une recette ne
déclenche pas le bandeau *(limite notée)*.

`mergeShoppingItems(previous, next)` (pure, pour la mise à jour) : voir C.

### Tests Vitest

Foyer de test (lundi soir en duo steak haché, midis céto de Marie-Laure, pique-nique du mercredi) :
facteurs (Timothé 1,5, Anna-Lucia et Otis 0,7), cumul multi-recettes et multi-unités (crème en g et
en c. à soupe, lait en l et en ml), conversion manquante en deux morceaux, arrondis, placard,
sources, signature stable, stock déduit, fusion.

## C : liste et écran

### Base (`0010_shopping_lists.sql`)

- `shopping_lists` : `id`, `household_id`, `week_plan_id` (unique, `on delete cascade`),
  `menu_signature`, `updated_at`.
- `shopping_items` : `id`, `household_id`, `list_id` (`on delete cascade`), `ingredient_id`
  (null possible, `on delete set null`), `label`, `amounts` jsonb, `aisle`, `pantry`, `sources` jsonb,
  `checked`, `removed`, `manual`, `position`, plus *(choix, colonnes non listées dans le prompt)* :
  - `needed` boolean : article du placard passé dans la liste (« Il n'en reste plus ») ;
  - `quantity_changed` boolean : mention « quantité modifiée », effacée quand on recoche ;
  - `quantity_text` text : quantité libre d'un article manuel.
- `household_id` recopié de la liste (ou de la semaine) par trigger, RLS par foyer comme le reste.
- `public.sync_shopping_list(target_week_plan_id uuid, signature text, items jsonb) returns uuid` :
  crée la liste si besoin, remplace les articles non manuels par `items` (déjà fusionnés côté TS),
  met à jour signature et `updated_at`, en une transaction, sous RLS.
- `public.add_shopping_item(target_list_id uuid, raw_label text, quantity_text text) returns uuid` :
  cherche le référentiel (`find_ingredient`, sans créer) ; trouvé (nom ou alias) → nom canonique,
  `ingredient_id` et rayon du référentiel *(choix : « oeufs » tapé vite devient « Œufs »)* ; sinon
  le texte tapé, rayon « autre ». Position en fin de rayon. Un article manuel n'a pas de sources :
  « Pour quoi ? » dit « Ajouté à la main ».
- pgTAP : RLS, second compte du même foyer (lit, coche), autre foyer (rien), `sync_shopping_list`
  (garde les manuels), `add_shopping_item` (rayon suivi, « autre » sinon).

### Génération et mise à jour

- Première ouverture d'une semaine qui a un menu et pas encore de liste : le serveur calcule (B) et
  appelle `sync_shopping_list`, pendant le chargement de la page *(choix : même fonction que l'action
  « Mettre à jour », idempotente grâce à l'unicité de `week_plan_id`)*.
- Ensuite, signature différente → bandeau discret « Le menu a changé · Mettre à jour la liste ».
  Jamais de mise à jour automatique.
- Mise à jour (`mergeShoppingItems`) : clé = `ingredient_id` (ou nom normalisé pour une ligne sans
  ingrédient) ; un article toujours au menu garde `checked`, `removed`, `needed` ; si une quantité a
  augmenté (un morceau plus grand, ou une unité nouvelle) → décoché, `quantity_changed`. Articles
  manuels gardés tels quels. Articles qui ne sont plus au menu : supprimés. Nouveaux : décochés.
- Un article manuel n'est jamais fusionné avec un article du menu de même produit : deux lignes
  *(choix)*.

### Écran `/courses`

Composants existants : `AppPage`, `PageHeader`, `WeekPicker`, `EmptyState` + `BasketIllustration`,
`Autocomplete` (nouvelle option `placement="top"` pour ouvrir vers le haut), `Sheet`, `Progress`,
`Button`, `Badge`.

```
┌─────────────────────────────┐
│ Courses                     │
│ ‹ Semaine du 23 au 29 nov › │
│ 12 sur 34  ▓▓▓▓▓░░░░░░░░░░  │  ← barre fine
│ ┌ Le menu a changé ·        │
│ └   Mettre à jour la liste ┘│  ← seulement si signature ≠
│ 🥕 Fruits et légumes    · 5 │
│ ☐ Oignons            4   ⋯ │  ← toute la ligne coche (≥ 48 px)
│ ☐ Courgettes         6   ⋯ │
│ ☑ C̶i̶t̶r̶o̶n̶s̶           2̶   ⋯ │  ← barré, glisse en bas du rayon
│ 🥩 Boucherie · tout est pris│  ← rayon tout coché : replié
│ …                           │
│ ▸ Placard · À vérifier      │  ← replié
│ ▸ Déjà à la maison (2)      │  ← replié, seulement s'il y en a
│ [ Copier la liste ]         │
│   Tout décocher             │  ← discret, confirmation
├─────────────────────────────┤
│ [Ajouter un article…][Qté]+ │  ← barre fixée
├─────────────────────────────┤
│  Semaine  Recettes  Courses │
└─────────────────────────────┘
```

- Semaine par défaut (sans `?semaine=`) : la prochaine si elle a au moins un plat, sinon la
  semaine en cours.
- Progression « 12 sur 34 » : articles à acheter (non masqués ; placard seulement s'il est passé
  dans la liste), cochés / total.
- Rayon : icône lucide *(choix : Carrot, Beef, Fish, Milk, Croissant, Wheat, Snowflake, CupSoda,
  ShoppingBasket ; Placard : Archive)*, titre, nombre restant ; tout coché → replié, réouvrable.
- Ligne : toute la ligne coche/décoche ; le panneau s'ouvre par le bouton « … » en bout de ligne,
  pas par le nom *(choix : le prompt dit « le nom (ou un bouton « … ») » ; avec toute la ligne qui
  coche, toucher le nom ouvrirait le panneau par erreur pendant les courses)*. Cocher : barré, glisse
  en bas de son rayon (`layout` framer-motion, respecte « réduire les animations »). Tri dans un
  rayon : non cochés puis cochés, chacun par `position`.
- Mention « quantité modifiée » en petit sous le nom quand `quantity_changed`.
- Panneau (`Sheet`) : nom et quantité ; « Pour quoi ? » (« Steak haché et frites · lun. soir ·
  4 pers. ») ; « J'en ai déjà » ; article manuel : « Modifier » (nom et quantité) et « Supprimer » ;
  article du placard passé dans la liste : « Remettre au placard ».
- « J'en ai déjà » : masqué ; il réapparaît dans la section repliée « Déjà à la maison », avec
  « Remettre dans la liste » *(choix : sinon une erreur de doigt est sans retour)*.
- Placard (replié, « À vérifier avant de commander ») : « Huile d'olive · pour 5 recettes » ; toucher
  une ligne → « Il n'en reste plus » : elle passe dans son rayon (décision de l'utilisateur).
- Barre « Ajouter un article » : autocomplétion sur le référentiel (rayon en indice), quantité en
  texte libre, bouton « Ajouter ». Rayon suivi si l'article est trouvé (nom ou alias), sinon
  « Autre ». Sur ordinateur, même barre, à la largeur de la colonne.
- « Copier la liste » : texte par rayon, articles non cochés et non masqués, placard exclu sauf
  articles passés dans la liste ; le bouton dit « Liste copiée » 2 s *(choix de format)* :
  ```
  Courses · Semaine du 23 au 29 novembre

  Fruits et légumes
  - Oignons : 4
  - Courgettes : 6
  ```
- « Tout décocher » : confirmation en deux touches, comme « Supprimer la recette ».
- Cases enregistrées tout de suite (mise à jour optimiste, retour en arrière et message si
  l'enregistrement échoue). Formulaires d'édition clés sur la donnée enregistrée (mémoire « formulaires
  pré-remplis »).
- Semaine sans menu et sans liste : `EmptyState` + lien « Préparer le menu » → `/semaine?semaine=…`.
- `/semaine` : bouton « Faire les courses » → `/courses?semaine=…`, près du sélecteur de semaine,
  visible quand la semaine a au moins un plat *(choix)*.
- `/design` : section « Liste de courses » (ligne cochée / non cochée / quantité modifiée, en-tête de
  rayon, rayon replié, panneau « Pour quoi ? », barre d'ajout).

### e2e Playwright

Compte neuf ; proposer la semaine ; ouvrir les courses ; vérifier un cumul (ingrédient présent dans
deux recettes : la proposition étant aléatoire, le test pose les plats lui-même ou choisit un
ingrédient sûr, comme le beurre ou l'huile) et l'ordre des rayons ; cocher ; ajouter un article
manuel ; changer un plat dans `/semaine` ; voir le bandeau ; mettre à jour ; la case cochée et
l'article manuel sont toujours là.

## Livraison

- Branche `etape-3-courses` partie de `plusieurs-plats` (fd71789). `main` n'a pas encore
  « Plusieurs plats » (PR #6 fusionnée dans `recettes-associees` après la fusion de #5) : PR de
  rattrapage `recettes-associees → main` d'abord, puis PR de l'étape 3 vers `main`.
- Commits : A, B, puis C en plusieurs commits ; CLAUDE.md (ligne `ingredients`, ligne
  `shopping_lists` + `shopping_items`, étape 3 cochée).
- `supabase test db`, `npm test`, `npm run build`, e2e, captures 375 px et ordinateur, clair et
  sombre, corrections.

## Laissé au constructeur

Noms internes, découpage des composants, les ~60 produits courants exacts et leurs alias, les
textes d'aide, les détails d'animation, dans la charte de `/design`.
