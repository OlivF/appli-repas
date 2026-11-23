# Vider la semaine : design

Complète CLAUDE.md et la charte de `/design`.

## Intention

Pouvoir retirer d'un coup tous les plats non verrouillés de la semaine affichée, sans en reposer
d'autres. C'est « Relancer » sans la nouvelle proposition. Aujourd'hui, il faut jeter les plats un
par un à la corbeille.

## Ce qui part, ce qui reste

- Partent : les plats (`course = main`) non verrouillés, sur les 7 jours, même ceux marqués
  « Pas cuisiné ».
- Restent : les plats verrouillés, les entrées, desserts, fruits, fromages et laitages (comme
  avec « Relancer »), les réglages « Qui est là ? » de la semaine (`week_meal_overrides`).
- La liste de courses n'est pas touchée : elle affiche « Le menu a changé » comme après tout
  changement de plat. Ses réservations dans le frigo restent jusqu'à sa mise à jour.

## Approches

- **A. Confirmation avant** (retenue) : un panneau comme « Tout remettre comme d'habitude ».
  C'est simple, ça suit un geste existant, une seule action serveur et pas de migration.
- B. Vider aussitôt, avec « Annuler » pendant 5 secondes, comme la corbeille. Écartée : il faudrait
  restaurer une dizaine de plats d'un coup, ce qui peut échouer en partie si un autre compte du
  foyer a touché la semaine entre-temps.

## Écran (`/semaine`)

- Bouton discret (ghost, icône corbeille) « Vider la semaine », affiché seulement s'il reste au
  moins un plat non verrouillé.
  - Téléphone : sous « Faire les courses ».
  - Ordinateur : sur la ligne du choix de la semaine, après « Faire les courses ».
- Panneau (Sheet), même forme que « Tout remettre » :
  - titre « Vider la semaine ? » ;
  - texte : combien de plats partent, ce qui reste (plats verrouillés, desserts, fruits…) ;
  - bouton principal « Vider », bouton ghost « Annuler ».
- Après « Vider » : les plats disparaissent tout de suite, puis un toast confirme (« 9 plats
  retirés »). En cas d'échec : l'écran revient comme avant et l'erreur s'affiche (comme les autres
  gestes).

## Code

- `lib/board.ts` : fonction pure qui choisit les cartes à retirer (non verrouillées et pas un
  à-côté), testée avec Vitest.
- `app/(app)/semaine/actions.ts` : `clearWeekAction(weekStart)`. Elle recharge la semaine
  (`loadWeek`), supprime ces cartes par leurs id (RLS du foyer) et rend les cartes de la semaine
  pour que l'écran colle au serveur.
- `week-board.tsx` : bouton, nouveau panneau `{ kind: "clear" }` dans les panneaux de la semaine,
  mise à jour optimiste.
- Test e2e : proposer, verrouiller un plat, ajouter un dessert, vider, confirmer. Le plat
  verrouillé et le dessert restent, les autres plats sont partis.

## Choix laissés à qui construit

- Formulations exactes (pluriels, « 1 plat part »).
- Ordre exact des boutons sur la ligne ordinateur, tant que tout tient à 1280 px.
