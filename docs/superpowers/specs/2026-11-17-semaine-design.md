# Étape 2, partie semaine — design

Validé le 2026-11-17. Complète CLAUDE.md (feuille de route, étape 2) et
`2026-11-17-recettes-design.md`.

## Intention

Le lundi, le foyer prépare le menu de la semaine suivante (rituel de CLAUDE.md). Un bouton
remplit toute la semaine d'un coup, en respectant les régimes et les goûts de chacun ; on
ajuste ensuite au doigt (téléphone) ou à la souris (ordinateur). Ce planning nourrira la liste
de courses (étape 3) : il faut donc savoir, pour chaque plat, qui le mange.

## Objectifs

- Tables `week_plans` et `planned_meals` (migration `0005_week_plans.sql` : 0003 et 0004 sont
  déjà pris).
- Algorithme « Proposer la semaine » en TypeScript pur (`lib/planner.ts`), testé par Vitest.
- Page `/semaine` : sélecteur de semaine, grille (ordinateur) ou un jour à la fois (téléphone),
  cartes glissables, verrou, « Autre idée », Bibliothèque.

## Hors champ

- Liste de courses, quantités par convive (étape 3), batch cooking, PWA (étape 4).
- Modifier à la main les mangeurs d'une carte, ajouter ou retirer une carte dans un créneau
  (hors Bibliothèque sur un créneau vide).
- Tenir compte des semaines précédentes pour varier.
- Glisser-déposer au clavier (les mêmes gestes existent en boutons : toucher une carte,
  « Autre idée », cadenas).

## À éviter absolument

- Un compte qui voit ou modifie le planning d'un autre foyer.
- Une proposition enregistrée à moitié (anciennes cartes effacées sans les nouvelles).
- Un « Relancer » qui écrase une carte verrouillée.
- Un membre présent à un repas sans aucun plat, alors qu'une recette lui convient.
- Un style fait à la main : tout passe par les composants de `/design`.

## Décisions de l'utilisateur

| Sujet | Choix |
| --- | --- |
| Accueil | `/` redirige vers `/semaine` ; l'actuel récapitulatif devient `/foyer` (onglet Foyer) |
| Pique-nique | Dans la ligne Midi de la grille, avec l'étiquette 🧺 Pique-nique |
| Petit-déj répété | Une même recette 2 fois au plus dans la semaine |
| Plus de recette inédite | Répéter celle servie le plus tôt dans la semaine, jamais deux jours de suite |
| Recette qui ne convient pas (échange, Bibliothèque) | Acceptée et signalée (avatar barré, « Ne convient pas à … ») ; mauvais type de repas toujours refusé |
| Bibliothèque sur téléphone | Toucher une carte (ou « + » sur un créneau vide) ouvre la Bibliothèque en panneau du bas, filtrée sur ce repas ; toucher une recette la pose. Ordinateur : tiroir à droite, glisser-déposer en plus |
| Ingrédient principal | Deviné : premier ingrédient des rayons boucherie / poissonnerie → volaille, bœuf, porc, agneau, poisson ; sans viande ni poisson, pas de contrainte |
| Le reste | Proposé par Claude (sections ci-dessous) et validé tel quel (« go ») |

## Approches envisagées

1. **Server Actions + `lib/planner.ts` côté serveur + fonctions SQL transactionnelles**
   (retenue) : même modèle que `save_recipe` ; la RLS s'applique (`security invoker`) ; une
   proposition s'écrit en une transaction.
2. Calcul dans le navigateur et écriture directe par le client Supabase : plusieurs appels,
   une coupure laisse une semaine à moitié écrite.
3. Calcul en SQL (plpgsql) : contraire à « code pur TypeScript ».

## Base de données (`0005_week_plans.sql`)

`week_plans` : `household_id`, `week_start date` (un lundi : `isodow = 1`), `seed integer`
(augmente à chaque « Proposer » / « Relancer »), unique `(household_id, week_start)`.

`planned_meals` : `household_id` (recopié de la semaine par trigger), `week_plan_id`
(`on delete cascade`), `day` 0–6, `meal_type`, `position` (ordre dans le créneau),
`recipe_id` (`on delete cascade` : une recette supprimée fait disparaître sa carte),
`member_ids uuid[]` (au moins un), `locked boolean`.

Trigger de cohérence : la recette est au catalogue ou au foyer ; les membres sont du foyer
(sans doublon). Un membre supprimé quitte ses cartes ; une carte vidée disparaît.
`copy_recipe` déplace aussi les cartes du foyer de l'originale vers la copie.

RLS : tout par foyer (`private.is_household_member`), aucun accès `anon`.

Fonctions (`security invoker`) :
- `save_week_proposal(target_household_id, target_week_start, new_seed, cards jsonb)` → id de
  la semaine : crée la semaine au besoin, pose la graine, supprime les cartes non verrouillées
  et insère `cards` (`[{day, meal_type, position, recipe_id, member_ids}]`), en une transaction.
- `swap_planned_meals(first_id, second_id)` : échange les recettes de deux cartes non
  verrouillées du même foyer ; les mangeurs restent à leur place.

## Algorithme (`lib/planner.ts`, pur)

> Depuis le 2026-11-19, un repas se propose par solutions entières (un plat pour tous, un plat par
> groupe de régimes, un duo de même base) : voir `2026-11-19-plusieurs-plats-design.md`. Les règles
> ci-dessous (disponibilité, repli, note d'une recette, déterminisme) restent valables.

Entrées : créneaux (`day`, `meal_type`, `member_ids`), membres (régimes), recettes (types,
régimes, membres exclus, favori, minutes, famille principale), cartes verrouillées, graine.
Sortie : les nouvelles cartes (les verrouillées ne bougent pas) et les membres sans plat.

- Une recette **convient** à un membre si elle respecte tous ses régimes et qu'il n'en est
  pas exclu. Elle **va** dans un créneau si elle a son type de repas.
- Créneaux traités dans l'ordre de la semaine (lundi → dimanche, petit-déj → dîner). Les
  membres déjà servis par une carte verrouillée sont retirés du créneau.
- Pour les membres restants : la meilleure recette disponible qui convient à tous ; sinon
  celle qui en couvre le plus (à égalité, la meilleure note), puis on recommence avec ceux
  qui restent.
- **Disponible** : pas encore dans la semaine (petit-déj : moins de 2 fois).
- **Repli** quand aucune recette disponible ne convient à personne parmi les restants : une
  recette déjà servie, pas la veille ni le lendemain, celle dont le dernier service est le
  plus tôt dans la semaine (puis celle qui couvre le plus). Sans rien du tout : membre noté
  « sans plat ».
- **Note** (la plus haute gagne) : favori +3 ; du lundi au vendredi +2 si ≤ 30 min, sinon
  −1 par quart d'heure au-delà ; samedi et dimanche +2 si ≥ 45 min ; même famille
  principale qu'un midi, pique-nique ou dîner de la veille, du lendemain ou du même jour −3 ;
  petit-déj déjà servi une fois −4 ; plus un petit écart tiré de la graine (0 à 1,5), qui
  départage les recettes proches.
- **Déterministe** : même graine + mêmes données → même résultat. L'écart vient d'un hachage
  de (graine, recette, jour, repas).
- **Autre idée** (`nextIdea`) : pour une carte, la meilleure recette (même note) qui convient
  à tous ses mangeurs, disponible, différente de celles déjà essayées pour cette carte ; sinon
  le repli ; sinon rien (« Pas d'autre idée pour l'instant »).
- **Famille principale** (`mainProtein`) : premier ingrédient au rayon boucherie ou
  poissonnerie ; mots-clés → `volaille` (poulet, dinde, canard…), `boeuf` (bœuf, veau,
  steak), `porc` (porc, jambon, lardons, bacon, saucisse…), `agneau`, `poisson` (saumon,
  thon, cabillaud, crevettes…) ; mot inconnu → le nom normalisé.

## Écrans

### Navigation

Onglet Semaine → `/semaine` ; `/` redirige vers `/semaine`. Onglet Foyer → `/foyer` :
l'actuel récapitulatif (nom, repas, membres, déconnexion), dans le cadre des onglets. Les
liens « Annuler » / « Retour » de `/bienvenue` et l'enregistrement des créneaux hors parcours
reviennent à `/foyer` ; la fin du parcours mène à `/semaine`.

### `/semaine`

- En-tête « La semaine » ; sélecteur ‹ Semaine du 23 au 29 novembre › (pastille « Semaine
  prochaine ») ; l'adresse porte `?semaine=AAAA-MM-JJ` (un lundi), la semaine prochaine par
  défaut (« aujourd'hui » pris à l'heure de Paris).
- Bouton principal « Proposer la semaine » (semaine vide), puis « Relancer » : garde les
  cartes verrouillées, sans confirmation. Les cartes arrivent en cascade.
- Tout geste est enregistré aussitôt (pas de bouton « Valider ») ; en cas d'échec, l'écran
  revient en arrière avec le message d'erreur habituel.
- **Ordinateur (≥ 1280 px)** : grille, une colonne par jour (« Lun 23 »), lignes Petit-déj,
  Midi (pique-nique compris), Dîner ; une ligne sans aucun créneau n'apparaît pas, une case
  où personne ne mange reste vide. Bouton « Bibliothèque » (dès 1024 px) : tiroir à droite
  avec recherche et puces (régimes, Favoris, Rapide ≤ 30 min, repas) ; on y glisse une
  recette sur une carte ou un créneau vide. Le tiroir s'efface pendant le glisser.
- **Téléphone** : un jour à la fois ; on balaie (défilement aimanté) ; une barre « Lun Mar
  … » saute à un jour. Entre 640 et 1279 px, plusieurs jours côte à côte, même défilement.
- **Carte** : photo (ou emoji du repas sur sa couleur), titre, temps, avatars des mangeurs
  (barrés pour qui elle ne convient pas, avec « Ne convient pas à … »), cadenas, « Autre
  idée » (absent si verrouillée). Toucher la carte ouvre le panneau « Changer le dîner de
  mardi » (Bibliothèque filtrée sur ce repas, lien « Voir la recette ») ; une recette choisie
  à la main se verrouille.
- **Glisser** : appui long (¼ s) au doigt, ou 6 px à la souris. Lâcher une carte sur une
  autre échange leurs recettes ; une recette de la Bibliothèque sur une carte la remplace,
  sur un créneau vide crée une carte pour tous ses présents (verrouillée). Refusé (cible
  estompée) : mauvais type de repas, carte verrouillée. Au bord de l'écran, le jour voisin
  arrive.
- Membres présents sans plat : « Rien de prévu pour Otis » sous le créneau.
- Animations : ressort framer-motion quand une carte se pose ou s'échange ; coupées si le
  système demande moins d'animations.

## Nouvelles pièces du design system (montrées sur `/design`)

Carte de planning (`PlannedMealCard`, en ligne sur téléphone, en colonne dans la grille,
verrouillée, avec alerte), créneau vide, sélecteur de semaine, barre des jours, Bibliothèque
(liste compacte de recettes avec recherche et puces).

## Tests

- Vitest : planner (tous servis, cartes multiples, pas de répétition, petit-déj ≤ 2, repli,
  verrous, déterminisme, autre graine → autre proposition, favoris, temps, variété, foyer de
  test complet), famille principale, dates de semaine.
- pgTAP : semaines et cartes cloisonnées par foyer, cohérence (recette, membres),
  `save_week_proposal` (garde les verrous), `swap_planned_meals`, membre supprimé,
  `copy_recipe`.
- Playwright (téléphone) : proposer, verrouiller puis relancer, autre idée, changer par la
  Bibliothèque ; (ordinateur 1440 px) échanger deux cartes en les glissant.
- Captures Pixel 7 et 1440 px, plus le mode sombre ; `npm run build`.

## Laissé à l'implémentation

Noms exacts des composants et fichiers, découpage client/serveur, textes d'aide, valeurs
d'animation.
