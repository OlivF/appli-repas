# Plusieurs plats sur un même repas : design

Validé le 2026-11-19 (« go »). Complète CLAUDE.md, la charte de `/design`, et la spec de la semaine
(`2026-11-17-semaine-design.md`) ; s'appuie sur les recettes associées (`2026-11-19-recettes-associees-design.md`).

## Intention

La base accepte plusieurs cartes par repas, et le planificateur en crée une seconde quand une recette
ne convient pas à tout le monde. En pratique, il choisit presque toujours un plat céto pour toute la
famille ; et à la main, on ne peut ni ajouter un plat à un repas rempli, ni dire qui mange quoi, ni
retirer un plat. Chez nous : Marie-Laure mange céto, les quatre autres non ; on veut le plus souvent un
duo de même base (steak haché + frites pour la famille, steak haché + haricots verts pour elle).

**Règle de base** : chaque présent mange un seul plat par repas. Mettre un membre sur un plat le retire
des autres plats du même repas ; un plat qui n'a plus personne disparaît. Les présents sans plat
s'affichent avec le « Rien de prévu pour … · Choisir » existant.

## Objectifs

1. Migration `0008` + pgTAP : `set_planned_meal_eaters`, `add_planned_meal`, suppression d'une carte.
2. Planificateur : solutions entières par groupes de régimes, duos de même base, réglages nommés.
3. Grille : « + Ajouter un plat » (bouton et zone de dépôt), « Pour qui ? », « Qui mange ce plat ? »,
   « Retirer ce plat », mention « Même base », « Autre idée » sur un duo.
4. CLAUDE.md, `/design`, Vitest, pgTAP, e2e, captures, build, PR.

## Hors champ

- Le glisser-déposer existant ne change pas (échange de cartes, recette lâchée sur une carte ou un
  créneau vide).
- « Choisir » sur un repas vide pose toujours le plat pour toute la table.

## Décisions de l'utilisateur

| Sujet | Choix |
| --- | --- |
| Basiques dans la proposition | Seulement à l'intérieur d'un duo de même base (avec l'autre groupe, ou une carte verrouillée de même base), jamais seules |
| Avatars cochés | Cercle tomate + coche ; le barré reste pour « ne convient pas » / « n'en mange pas » |
| « Qui mange ce plat ? » | Bouton « Valider » ; au moins une personne cochée |
| Branche | `plusieurs-plats` partie de `recettes-associees`, PR empilée sur #5 |
| Le reste | Prompt « B » de l'utilisateur, plus les choix de Claude ci-dessous, validés (« go ») |

## Approches envisagées

1. **Solutions entières par repas** (retenue, demandée) : regrouper les présents par régimes, comparer
   « un plat pour tous », « un plat par groupe sans base commune » et « un duo par base », noter chaque
   solution. Peu de candidates (une par base), donc rapide.
2. Carte par carte avec un bonus de base (l'algorithme actuel + bonus) : il prend d'abord le plat qui
   couvre le plus, donc un plat céto pour tous ; le duo n'arrive jamais.
3. Recherche exhaustive des combinaisons : inutile pour 2 ou 3 groupes, et lente sur 75 recettes.

## Planificateur

Réglages en tête de `lib/planner.ts` : `SAME_BASE_BONUS = 5`, `SAME_PROTEIN_BONUS = 2`,
`KETO_FOR_OTHERS_PENALTY = 3`, `EXTRA_CARD_PENALTY = 1`, `BASE_REPEAT_PENALTY = 3`.

- `PlannerRecipe` gagne `base` (clé normalisée, `null` sans base) ; `basic` existe déjà.
- Groupes : les présents non servis par une carte verrouillée, regroupés par régimes identiques.
- Candidates d'une solution : recettes du bon repas, disponibles (plafonds, pas deux jours de suite),
  qui conviennent à tous les membres de leur groupe (régimes et exclusions), différentes entre elles.
  Une basique n'entre que dans une solution où au moins deux cartes du repas (verrouillées comprises)
  ont sa base.
- Solutions : la meilleure recette pour tous ; si 2 groupes ou plus, la meilleure par groupe ; pour
  chaque base, la meilleure recette de cette base par groupe (ou, avec un seul groupe, quand une carte
  verrouillée du repas a cette base).
- Note = somme des notes actuelles des cartes ; +5 si toutes les cartes du repas (≥ 2, verrouillées
  comprises) ont la même base, sinon +2 si elles ont la même famille de protéine ; −3 par carte céto
  servie à au moins un membre non céto ; −1 par carte ajoutée au-delà de la première ; −3 par repas
  déjà servi dans la semaine avec la même base (un duo compte une fois).
- Aucune solution complète : l'algorithme actuel, carte par carte, avec son repli.
- « Autre idée » sur une carte d'un duo (autre carte du repas de même base) : autre carte libre → un
  nouveau duo pour les deux, sur une base différente de l'actuelle et de celles déjà essayées ; autre
  carte verrouillée → une autre recette de sa base. Sinon, comme avant.
- Conséquence assumée : les petits-déjeuners ont souvent deux plats aussi.

## Base de données (`0008_planned_meal_eaters.sql`)

- `set_planned_meal_eaters(target_card_id uuid, eater_ids uuid[]) returns void` : refuse une liste vide
  (`23514`) ou une carte invisible (`P0002`) ; supprime les autres cartes du repas dont tous les
  mangeurs passent sur celle-ci, retire ces mangeurs des autres ; pose les mangeurs et verrouille la
  carte. `security invoker`, RLS inchangée.
- `add_planned_meal(target_household_id, target_week_start, target_day, target_meal_type,
  target_recipe_id, eater_ids) returns uuid` : crée la semaine au besoin, ajoute une carte verrouillée
  en dernière position, puis `set_planned_meal_eaters`.
- Retirer un plat : `delete` sous la RLS existante.

## Écrans

- Sous les cartes d'un repas rempli : « Même base : steak haché » (icône `Link`, une ligne) quand au
  moins deux cartes partagent une base ; puis « + Ajouter un plat », variante compacte du créneau vide
  (`EmptySlot`), aussi zone de dépôt (`add:<jour>:<repas>`).
- « Ajouter un plat » : panneau « Ajouter un plat au dîner de lundi » ; « Pour qui ? » (présents, régime
  sous le prénom), pré-cochés : les présents qui ont un régime ; la Bibliothèque filtrée pour les cochés,
  la base du repas en tête. Toucher une recette l'ajoute ; personne coché → « Touche d'abord qui mange
  ce plat ». Après un dépôt : même panneau avec la recette choisie et « Valider ».
- Avatars d'une carte : bouton séparé → « Qui mange ce plat ? » ; cochés = mangeurs actuels ; « ⚠ Ne
  convient pas à … » pour un coché que son régime ou une exclusion écarte ; « Valider » (grisé sans
  personne).
- « Changer » : bouton discret « Retirer ce plat », sans confirmation.
- `MemberToggle` gagne une variante de choix (`aria-label` « Léa mange ce plat », cercle tomate +
  coche).

## Tests

- Vitest : foyer de test (lundi soir duo de même base, céto pour Marie-Laure seule ; midi de
  Marie-Laure une carte céto ; mercredi pique-nique inchangé ; foyer sans régime un plat par repas ;
  pas de base en double quand il y a le choix ; déterminisme), « Autre idée » sur un duo, `moveEaters`,
  composants.
- pgTAP : les deux fonctions, suppression, cloisonnement.
- e2e : proposer, duo le lundi soir, ajouter un plat pour Timothé, changer les mangeurs, retirer un plat ;
  les parcours existants recalés.
