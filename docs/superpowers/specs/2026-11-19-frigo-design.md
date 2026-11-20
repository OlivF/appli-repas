# Étape 3 bis : dans le frigo : design

Validé le 2026-11-19 (« go »). Complète CLAUDE.md, la charte de `/design` et la spec des courses
(`2026-11-19-courses-design.md`). Source : le prompt A/B/C de l'utilisateur (2026-11-19), ses
réponses ci-dessous, et les choix de Claude marqués *(choix)*.

## Intention

Le frigo, c'est ce qu'on a à la maison et qu'on ne veut ni racheter ni jeter. Il se remplit en deux
gestes (« Ranger les courses » après le drive du jeudi, « Il en reste » sur un plat), se vide tout
seul quand la semaine est passée (le bilan retire ce qui a été cuisiné), et la liste de courses en
tient compte. On l'ouvre devant le frigo ouvert, au téléphone, d'une main : voir ce qu'il faut finir
vite, ajouter un reste en trois touches, dire « fini » en une. Plus tard, la génération du menu par
IA lira le frigo (`fridgeForMenu`) pour privilégier les restes à finir.

## Objectifs

- **A** : table `fridge_items`, colonnes de réservation et de bilan sur les listes, `skipped` sur les
  plats, `sync_shopping_list` et `apply_fridge_settlement`, durées de conservation du référentiel,
  calcul pur (`lib/fridge.ts`, `weekNeeds` et le frigo dans `lib/shopping.ts`), Vitest et pgTAP.
- **B** : 5ᵉ onglet « Frigo » avec pastille, écran `/frigo`, ajout, panneau d'un article, « Fini »
  avec « Annuler », section `/design`, `loadFridgeForMenu`.
- **C** : la liste déduit le frigo et le montre, bandeau « Le frigo a changé », « Ranger les
  courses », « Pas cuisiné » et « Il en reste » sur `/semaine`, bande « À finir », bilan au
  chargement, CLAUDE.md, e2e, captures, PR.

## Non-objectifs

- Rien de l'IA : seulement la forme stable `fridgeForMenu` et `loadFridgeForMenu`.
- La proposition automatique de la semaine ne change pas.
- « J'en ai déjà » garde son rôle actuel (masquer un article), sans lien avec le frigo.
- Pas de temps réel entre deux téléphones.

## Anti-objectifs

- Compter deux fois le même reste (deux listes, ou la liste et le bilan).
- Une mise à jour automatique de la liste (le bandeau propose, on décide).
- Inventer une quantité : une quantité inconnue ne déduit rien.
- Un bandeau « Le frigo a changé » sur toutes les listes existantes juste après la migration.

## Décisions de l'utilisateur (questions du 2026-11-19)

| Sujet | Choix |
| --- | --- |
| Toast (« Annuler », « Rangé au frigo ») | Sonner via shadcn/ui (dépendance `sonner`), thème par les variables CSS |
| Encart du bilan | Sur `/frigo`, le dernier bilan des 7 derniers jours tant qu'on ne l'a pas fermé ; fermeture retenue sur l'appareil |
| Articles réservés dans « À finir vite » | Même règle que les autres (périmé ou J+2 au plus), si la date tombe avant le dimanche de leur semaine |
| Déroulé | Une branche `frigo` ; arrêt après A et après B pour validation ; PR à la fin de C |
| Langue | Messages à l'utilisateur en français |

## Approches

Une seule voie raisonnable, retenue, dans la ligne des courses : calcul pur en TypeScript (stock
libre, signature, bilan) testé avec Vitest ; Postgres garde les invariants (foyer, unité, RLS) et
applique les écritures groupées en une transaction (`sync_shopping_list`, `apply_fridge_settlement`).
Écartées : calculer le bilan en SQL (deuxième logique de mise à l'échelle, interdite par la
consigne) ; réserver par une table de liaison article de frigo ↔ article de liste (plus fin, mais
la consigne enregistre la réservation sur l'article de la liste, `from_fridge`, ce qui suffit pour
ne pas compter deux fois).

## Le modèle en bref

- Un article du frigo est **libre** (`reserved_list_id` null : un reste, utilisable par n'importe
  quelle semaine) ou **réservé** à la liste d'une semaine (rangé depuis les courses).
- Le **stock libre** d'une liste L, par ingrédient = somme des quantités des articles libres −
  `from_fridge` des articles des autres listes pas encore soldées (jamais négatif). Les articles
  libres sans quantité forment l'ensemble **maybe**.
- La liste L prend `from_fridge = min(stock, besoin exact)` et l'enregistre : c'est sa réservation.
- **Bilan** (semaine finie, dimanche passé à Paris) : besoin exact des plats non « Pas cuisiné » ;
  par ingrédient, on consomme les articles réservés à L, puis les libres dans la limite de
  `from_fridge`, date la plus proche d'abord ; reliquat minuscule supprimé ; tout ce qui reste
  réservé à L redevient libre ; `settled_at` rempli.
- Toutes les quantités dans l'unité d'achat (g, ml, piece) ; reste de plat : quantité en parts,
  sans unité.

## A : données et calcul

### Migration `0011_fridge.sql`

`fridge_items` :

| Colonne | Type | Note |
| --- | --- | --- |
| `id` | uuid | |
| `household_id` | uuid not null | recopié par trigger (voir plus bas) |
| `ingredient_id` | uuid null | FK `ingredients`, `on delete set null` |
| `label` | text 1–80 | nom canonique de l'ingrédient, ou texte libre (« Reste : Lasagnes ») |
| `quantity` | numeric null, > 0 | dans `unit` ; parts pour un reste de plat |
| `unit` | `shopping_unit` null | avec un ingrédient : forcément son unité d'achat |
| `best_before` | date null | date limite |
| `origin` | enum `fridge_origin` (`manual`, `shopping`, `leftover`) | |
| `recipe_id` | uuid null | FK `recipes`, `on delete set null` ; reste de plat |
| `reserved_list_id` | uuid null | FK `shopping_lists`, `on delete set null` ; null = libre |
| `created_at`, `updated_at` | timestamptz | `updated_at` par trigger |

- Le rayon n'est pas stocké : il vient de l'ingrédient ; texte libre → « Autre » *(choix)*.
- Trigger `before insert or update` *(choix)* : `household_id` pris de la liste réservée si elle
  existe, sinon de l'ingrédient s'il est propre à un foyer, sinon celui donné par l'appli ; une
  liste ou un ingrédient d'un autre foyer (invisible sous la RLS) → refusé. Unité : vide → unité
  d'achat de l'ingrédient ; différente → erreur (pas de correction silencieuse) *(choix)*.
- RLS par foyer (`is_household_member`), comme `shopping_items`.
- `shopping_items` : `from_fridge numeric not null default 0` (≥ 0), `maybe_in_fridge boolean`,
  `stored boolean`.
- `shopping_lists` : `fridge_signature text not null default ''`, `stored_at timestamptz`,
  `settled_at timestamptz` ; les listes des semaines passées (`week_start + 7 <= aujourd'hui à
  Paris`) prennent `settled_at = now()`.
- `planned_meals.skipped boolean not null default false`.
- `sync_shopping_list(target_week_plan_id, signature, fridge_signature, items)` remplace l'ancienne
  version (supprimée) *(choix)* : enregistre aussi `from_fridge`, `maybe_in_fridge`, `stored`.
- `apply_fridge_settlement(target_list_id uuid, changes jsonb) returns boolean` : `select … for
  update` sur la liste ; `settled_at` déjà rempli → rien, rend false ; sinon applique `[{id,
  quantity}]` (nouvelle quantité, ou suppression si null) aux articles du foyer, libère tous les
  articles encore réservés à la liste, remplit `settled_at`, rend true. Invoker, RLS appliquée.
- `ingredients.shelf_life_days` rempli pour le commun, seulement fruits et légumes, boucherie,
  poissonnerie, crèmerie, boulangerie, surgelés : viandes et poissons frais 2–3 j, viande hachée 1,
  crèmerie 5–7 (ouverte), fromages 10–15, légumes et fruits fragiles 3–5, légumes qui tiennent
  14–30, pain 2, surgelés 90 ; liste exacte dans le message du commit.

### `lib/fridge.ts` (pur)

- `SOON_DAYS = 2` en tête de fichier.
- `fridgeStatus(item, today)` → `expired` (date passée) | `soon` (aujourd'hui à J+SOON_DAYS) | `ok`
  | `none` (pas de date). `daysLeft(item, today)`.
- `defaultBestBefore(ingredient, today)` : `today + shelf_life_days`, sinon null.
- `availableStock({ items, reservations, listId })` → `{ stock: Record<ingredientId, number>,
  maybe: Set<ingredientId> }` : articles libres seulement ; `reservations` = `from_fridge` par
  ingrédient des autres listes non soldées (celles de `listId` ignorées). Un ingrédient peut avoir
  du stock et être aussi « maybe » *(choix)*.
- `fridgeSignature(stock, ingredientIds)` : stable (tri), limitée aux ingrédients donnés ; chaîne
  vide quand rien du frigo ne concerne ces ingrédients *(choix : pas de bandeau sur les listes
  existantes)* ; sinon empreinte FNV-1a comme `menuSignature`.
- `settleWeek({ items, listId, fromFridge, needs })` → `[{ id, quantity: number | null }]` (voir le
  modèle). Les articles sans quantité et les restes de plat ne sont pas touchés (ils redeviennent
  libres) *(choix)*. Reliquat < 10 g, < 10 ml, < 0,5 pièce → supprimé.
- `fridgeForMenu(items, today)` : « Contrat pour le menu IA : ne pas changer sans mettre à jour le
  prompt ». Tri : périmé, bientôt, sans date, ok (puis date, puis nom). Entrée `{ ingredientId,
  recipeId, name, quantity, unit, bestBefore, daysLeft, status, reserved }`.

### `lib/shopping.ts`

- `weekNeeds({ meals, recipes, members, ingredients, weekStart })` : besoin exact par ingrédient
  dans l'unité d'achat, sans arrondi ; partage le cumul de `buildShoppingList` (une seule mise à
  l'échelle). Les morceaux non convertibles (cuillères sans densité) et le placard n'y sont pas :
  le bilan ne les déduit pas *(choix)*.
- `buildShoppingList(…, stock, maybeInFridge)` : `fromFridge = min(stock, besoin exact)` ; reste à
  acheter arrondi ; un article entièrement couvert reste avec `amounts: []` (sauf morceaux non
  convertibles) et `fromFridge`. `maybeInFridge: true` sur l'article d'un ingrédient « maybe ».
- `StoredItem` : `from_fridge`, `maybe_in_fridge`, `stored`. `mergeShoppingItems` reprend les deux
  premiers du calcul et garde `stored`.
- `shoppingSections` : `home` = « J'en ai déjà » + articles entièrement au frigo (pas au placard,
  `amounts` vide, `from_fridge > 0`) ; ces derniers sortent de la progression et du texte copié.

### Tests

Vitest (foyer de test) : statuts de date (aujourd'hui, demain, J+2, J+3, passée, sans date) ;
`defaultBestBefore` ; stock libre avec une réservation d'une autre liste ; pas de double comptage
entre deux semaines ; crème 200 g au frigo pour 350 g (150 g à acheter, `fromFridge` 200), puis
500 g (article dans « Déjà à la maison ») ; ingrédient sans quantité ; bilan : 6 œufs rangés, 4
consommés, 2 libres ; plat « Pas cuisiné » ; reliquat minuscule ; `fridgeForMenu` trié ; signature
vide puis stable. Tests existants mis à jour (article couvert). pgTAP : RLS, foyer recopié, trigger
d'unité, `sync_shopping_list` (nouvelles colonnes), `apply_fridge_settlement` (deux appels : le
second ne fait rien), `settled_at` des listes passées.

## B : l'écran Frigo

- Onglet « Frigo » (lucide `Refrigerator`) entre Courses et Foyer, barre du bas (5 colonnes, tient
  à 375 px) et header. Pastille tomate = articles dans « À finir vite » (0 → rien). Compte calculé
  côté serveur dans le layout `(app)`, rafraîchi après chaque action du frigo *(choix technique)*.
- `/frigo` : page serveur, `connection()`. Au chargement : bilan des semaines finies, puis lecture.
- Ordre : champ « Ajouter au frigo » (toujours en haut), encart du bilan, « À finir vite » (s'il y
  en a : périmés puis bientôt), « Restes » (libres, par rayon dans l'ordre `SHOPPING_AISLES`, restes
  de plat en premier), « Pour le menu de la semaine » (réservés, replié, avec la semaine). Chaque
  article n'apparaît qu'une fois : un réservé urgent est dans « À finir vite » avec la mention de sa
  semaine *(choix)*.
- Règle « À finir vite » : libre → `expired` ou `soon` ; réservé → idem et `best_before` ≤ dimanche
  de sa semaine (décision de l'utilisateur).
- Ligne : nom ; quantité à droite (« 200 g », « 1,2 kg », « 3 », « 2 parts », rien) ; date en petit :
  « Périmé hier ? », « Périmé depuis 3 jours ? » (tomate), « Aujourd'hui », « Demain »,
  « Après-demain » (moutarde), « jusqu'au jeu. 26 » *(choix des libellés au-delà du prompt)*. Toute
  la ligne ouvre le panneau ; bouton rond « Fini » (48 px) à droite : l'article sort avec une
  animation framer-motion, toast « Annuler » 5 s ; supprimé aussitôt en base, « Annuler » le
  réinsère à l'identique (même id) *(choix)*.
- Ajouter : `Autocomplete` sur le référentiel (rayon en indice). Texte tapé qui correspond à un nom
  ou un alias → lié à l'ingrédient (comme l'ajout des courses) *(choix)* ; sinon texte libre (rien
  déduit des courses). Puis panneau : quantité facultative avec l'unité d'achat (« g », « ml »,
  « pièces »), puces de date « Aujourd'hui », « Demain », « Dans 3 jours », « Dans 1 semaine »,
  « Choisir… » (champ date natif), « Pas de date » ; pré-sélection `defaultBestBefore` ; une date
  par défaut hors préréglage → « Choisir… » sélectionné avec la date affichée *(choix)*. Gros bouton
  « Ranger ». Chaque ajout est une ligne à part (pas de fusion) *(choix)*.
- Panneau d'un article : quantité (− / + au pas : 50 g, 50 ml, 1 pièce, 1 part ; − s'arrête à un
  pas ; champ vidé = quantité inconnue *(choix)*), date (mêmes puces), « Fini », et pour un réservé
  « C'est un reste » (le libère).
- Vide : `EmptyState` « Rien au frigo pour l'instant », « Après le drive, range tes courses ici :
  l'appli s'en servira pour ta prochaine liste. », nouvelle `FridgeIllustration` au trait dans
  `components/illustrations.tsx` *(choix)*.
- Encart du bilan : « Semaine du 16 nov. terminée : on a retiré ce qui a été cuisiné. Il te reste 6
  articles. » (N = articles au frigo après le bilan *(choix)*), bilans des 7 derniers jours,
  fermeture retenue dans `localStorage` par liste.
- `lib/fridge-data.ts` (chargement, bilan, `loadFridgeForMenu(householdId)` + test avec un client
  factice) ; `app/(app)/frigo/actions.ts` (mises à jour optimistes).
- Toast : composant shadcn `sonner`, `<Toaster>` dans le layout racine, thème Popote.
- `/design` : section « Frigo » (ligne normale, à finir vite, périmée, panneau d'ajout avec les
  puces, toast).

## C : le frigo dans les courses et la semaine

- `lib/shopping-data.ts` : au calcul et à la mise à jour, `availableStock` pour cette liste et
  `maybe`, `fridge_signature` enregistrée. À l'ouverture : signature recalculée sur les ingrédients
  des articles non manuels de la liste *(choix : pas de rechargement des recettes)* ; bandeau
  « Le menu a changé » (prioritaire) ou « Le frigo a changé » · « Mettre à jour la liste ».
- « Déjà à la maison » (indice « Au frigo ou déjà là » *(choix)*) : article entièrement au frigo →
  « 500 g au frigo ». Article en partie couvert : quantité à acheter et, dessous, « + 200 g au
  frigo ». `maybe_in_fridge` : « Tu en as peut-être au frigo ». « Pour quoi ? » : ligne « Au frigo :
  200 g, jusqu'au mar. 24 » (quantité prise, date la plus proche des articles libres de
  l'ingrédient) *(choix)*.
- Ranger les courses (`/courses`) : carte « Courses faites ? Range-les au frigo » · « Ranger » /
  « Plus tard » quand `stored_at` est vide, la liste pas soldée, au moins un article coché pas encore
  rangé, et (tout est coché, ou on est au plus tôt le jeudi avant la semaine). « Plus tard » : pour
  la session (`sessionStorage`). Bouton discret « Ranger au frigo » en bas tant qu'il reste un
  article coché pas rangé *(choix)*. Panneau : articles cochés pas rangés, case, quantité (montant
  dans l'unité d'achat ; article manuel : « 6 », « 500 g »… lu si l'unité colle, sinon inconnue
  *(choix)*), date pré-remplie (`defaultBestBefore`) qu'on change en touchant la date (mêmes puces)
  *(choix)*. Pré-cochés : avec ingrédient, hors placard, hors « Boissons » et « Autre ». « Ranger N
  articles » : articles réservés à la liste (`origin = shopping`), `stored = true`, `stored_at`.
  « Non merci » : `stored_at` sans rien ranger.
- `/semaine`, panneau d'un plat d'aujourd'hui ou d'un jour passé de la semaine en cours, sous « Voir
  la recette » : « Pas cuisiné » (bascule `skipped`, carte grisée « Pas cuisiné ») ; « Il en reste »
  → bloc « − 1 part + » et « Ranger au frigo » *(choix)* → reste « Reste : Lasagnes », `leftover`,
  `recipe_id`, date J+3, toast « Rangé au frigo ».
- Bande « À finir : blancs de poulet, crème fraîche épaisse, courgettes » (3 noms, puis « et N
  autres ») en haut de `/semaine` quand « À finir vite » n'est pas vide, lien vers `/frigo`.
- Bilan au chargement de `/frigo`, `/courses`, `/semaine` : listes du foyer dont la semaine est
  finie et pas soldées → `weekNeeds` (plats non `skipped`), `settleWeek`, `apply_fridge_settlement`.
  Silencieux, sauf l'encart de `/frigo`.
- CLAUDE.md : ligne `fridge_items`, ligne `shopping_lists` mise à jour, feuille de route (3 bis ✅,
  « Génération du menu par IA » avant le batch cooking).
- e2e : le parcours du prompt ; le test pose lui-même un plat à la crème (la proposition est
  aléatoire). Le bilan est couvert par Vitest et pgTAP.

## Livraison

- Branche `frigo` depuis `main` (dc42abe, PR #8 fusionnée). Commits : A ; B ; C. Arrêt pour
  validation après A et après B. PR vers `main` à la fin de C.
- `supabase test db`, `npm test`, `npm run build`, e2e, captures 375 px et ordinateur, clair et
  sombre.

## Laissé au constructeur

Noms internes, découpage des composants, textes d'aide, détails d'animation dans la charte de
`/design`, valeurs exactes de `shelf_life_days` dans les fourchettes données.
