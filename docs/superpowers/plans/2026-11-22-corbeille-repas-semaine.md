# Corbeille et repas propres à une semaine : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** saisir le menu plus vite. A : jeter un plat (même verrouillé) ou une puce dans une
corbeille qui n'apparaît que pendant le glisser, avec « Annuler ». B : changer les repas d'**une**
semaine (retirer, ajouter, qui est là) sans toucher au réglage du foyer, qui reste le modèle.

**Architecture :** A ne touche pas la base : nouvelle cible dnd-kit `trash`, `removeCard` existant,
`restoreCardAction` pour « Annuler ». B : table `week_meal_overrides` (une ligne par repas changé,
`member_ids` vide = pas de repas) ; `weekSlots` calcule les repas effectifs, et `loadWeek` les
renvoie dans `slots` : toutes les actions de `/semaine` suivent sans autre changement.
`set_week_meal` / `reset_week_meals` retirent des plats les absents (`private.trim_week_cards`).

**Tech Stack :** Supabase (Postgres, pgTAP), Next.js 16 App Router, dnd-kit, framer-motion, Sonner,
Vitest, Playwright.

**Spec :** le prompt « Corbeille et repas propres à une semaine » (conversation du 22/11), plus les
réponses : phrase neutre « X quittera son plat. » / « Le plat de X sera retiré. » ; marque « cette
semaine » en texte (pas un point).

## Global Constraints

- Branche `corbeille-repas-semaine` depuis `main` (3b38373). Commit A « Semaine : corbeille pour
  retirer un plat », commit B « Semaine : repas propres à une semaine », puis une PR vers `main`.
- Migration `0019_week_meal_overrides.sql`. Types : `supabase gen types typescript --local --schema public > lib/supabase/database.types.ts`.
- Fonctions SQL : `set search_path = ''`, `revoke … from public, anon`, `grant execute … to authenticated`.
- Interface en français, tutoiement, zéro jargon, composants existants, couleurs par variables du
  thème (tomate : `primary` / `tomato-soft` / `tomato-deep` ; moutarde : `mustard-deep`).
- Le genre des membres est inconnu : aucune phrase n'accorde au prénom (« son plat », « leur plat »).
- `prefers-reduced-motion` : `MotionConfig reducedMotion="user"` s'en charge, ne rien forcer.
- Tests : `supabase test db`, `docker compose exec web npm test`, `docker compose exec web npx tsc --noEmit`,
  `docker compose exec web npm run lint`, `docker compose run --rm e2e`.

## Review Focus

- Glisser vers la corbeille, en bas de l'écran : la page ne doit pas défiler toute seule
  (auto-scroll dnd-kit coupé quand `over` = `trash`) ni changer de jour (`EDGE`). → e2e Task 3 : le
  jour affiché et la position de défilement restent les mêmes après le dépôt.
- « Annuler » alors qu'un autre plat a pris les mangeurs entre-temps → seuls ceux sans plat
  reviennent, sinon le message d'erreur. → Vitest `restorableEaters` (Task 1).
- Un repas ajouté puis « Comme d'habitude » → le repas et ses plats disparaissent, pas de carte
  orpheline. → pgTAP (Task 4) : `set_week_meal` avec le créneau du foyer (vide) supprime les cartes.
- Supprimer un membre qui était le seul d'un repas ajouté → pas d'exception vide (« pas de repas »)
  créée par accident. → pgTAP (Task 4).
- Semaine sans `week_plans` (jamais ouverte) : « Qui est là ? » doit créer la semaine. → pgTAP
  (Task 4) `set_week_meal` sur une semaine neuve.

---

## A : la corbeille

### Task 1 : règles pures du glisser et du retour

**Files :** Modify `lib/board.ts`, `lib/board.test.ts`.

**Interfaces (produites) :**
- `type BoardDrag = { kind: "card"; card: DragCard } | { kind: "extra"; card: DragCard } | { kind: "recipe"; recipe: { meal_types: readonly MealType[] } }`
  avec `DragCard = { id: string; recipe_id: string; meal_type: MealType; locked: boolean }`.
- `canDropOn(drag: BoardDrag, targetId: string, cards: readonly DragCard[], fits: (recipeId: string, mealType: MealType) => boolean): boolean`
- `restorableEaters({ card, cards, presentIds }: { card: { id?: string; day: number; meal_type: MealType; member_ids: readonly string[]; course?: Course }; cards: readonly {…même forme, id}[]; presentIds: readonly string[] }): string[]`

- [ ] Tests `canDropOn` : `trash` accepté pour `card` (verrouillé ou non) et `extra`, refusé pour
  `recipe` ; plat verrouillé → `card:x`, `slot:…`, `add:…` refusés ; `extra` → tout refusé sauf
  `trash` ; cible `card:` verrouillée refusée ; règles actuelles inchangées (échange si chaque
  recette va au repas de l'autre ; recette → `slot:`/`add:` si elle va au repas).
- [ ] Tests `restorableEaters` (foyer de test) : plat pour Olivier + Timothé, Timothé a déjà un
  autre plat au repas → `[Olivier]` ; un absent du repas est écarté ; dessert pour tous, tout le
  monde a un plat → tous restent ; personne → `[]`. Les plats légers des autres ne comptent pas.
- [ ] `npm test` → rouge ; implémenter (`canDrop` de `week-board.tsx` déplacé ici, inchangé
  pour les cas existants) ; vert.

### Task 2 : la corbeille et les puces glissables

**Files :** Modify `app/(app)/semaine/board-pieces.tsx` ; Create `app/(app)/semaine/board-pieces.test.tsx`.

**Interfaces (produites) :**
- `TrashZone({ over, demo = false }: { over: boolean; demo?: boolean })` : `useDroppable({ id: "trash" })`,
  racine `motion.div` (entrée `y: "120%"` → 0 avec `SPRING`, `exit` inverse). Rond ~4.5 rem, `Trash2`,
  libellé dessous « Retirer du menu », au-dessus « Lâche pour retirer » + `scale` ~1.12 + fond
  `primary` / texte `primary-foreground`. Hors `demo` : `fixed left-1/2 -translate-x-1/2 z-50`,
  `bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-8` (barre d'onglets : `min-h-15` + `p-1.5`).
  `demo` : dans le flux (page `/design`).
- `DraggableExtra({ id, children })` : `useDraggable({ id: \`extra:${id}\` })`, mêmes classes que
  `DraggableRecipe` (opacité pendant le glisser, `touch-manipulation select-none`).
- `BoardCard` : `useDraggable` jamais désactivé ; `cursor-grab` sur tous les plats.
- Commentaire d'en-tête : ajouter `extra:<id>` et `trash`.

- [ ] Test (dans un `DndContext`) : `TrashZone over={false}` montre « Retirer du menu »,
  `over` → « Lâche pour retirer » et un `data-over` (ou classe) qui change.
- [ ] Rouge, implémenter, vert.

### Task 3 : brancher la corbeille dans la semaine, « Annuler », /design, e2e

**Files :** Modify `app/(app)/semaine/week-board.tsx`, `app/(app)/semaine/actions.ts`,
`app/design/interactive-demos.tsx`, `app/design/page.tsx`, `e2e/semaine.spec.ts` (ou nouveau `e2e/corbeille.spec.ts`).

**Interfaces :**
- Consomme : `canDropOn`, `restorableEaters`, `TrashZone`, `DraggableExtra`.
- Produit : `restoreCardAction(weekStart: string, card: WeekCard): Promise<CardsResult>` ;
  message `RESTORE_NONE = "Ce plat ne peut plus revenir : tout le monde a déjà un plat à ce repas."`.

- [ ] `restoreCardAction` : `loadWeek` ; recette cherchée dans `recipes` + `extraRecipes` (la sorte
  vient de la recette, pas du client) ; `presentIds` = créneau de `slots` ; `restorableEaters` ;
  vide → `RESTORE_NONE`. Plat léger dont la recette est déjà au repas → fusion des mangeurs
  (update), sinon insert `planned_meals` (jour, repas, position, recette, mangeurs, `locked`,
  `skipped`) dans `plan.id` (pas de semaine → `SAVE_ERROR`). Rend `cardsOfWeek`.
- [ ] `week-board.tsx` : `Drag` gagne `{ kind: "extra"; card }` ; `canDrop` → `canDropOn` ; puces
  enveloppées dans `DraggableExtra` ; `onDragStart` reconnaît `extra:` ; `DragOverlay` montre la
  `ExtraChip` soulevée (`shadow-lift`). `<AnimatePresence>{drag && drag.kind !== "recipe" && <TrashZone over={overId === "trash"} />}</AnimatePresence>`.
- [ ] Dépôt sur `trash` : `removeCard(card.id)`, `navigator.vibrate?.(15)`, puis
  `toast(\`${titre} retiré ${fromMeal} de ${jour}\`, { duration: 5000, action: { label: "Annuler", onClick } })`
  où `fromMeal` vient de `MEAL_NOUN` (« le dîner » → « du dîner ») ; `onClick` appelle
  `restoreCardAction` puis `syncCards(result.cards, before, card.vid)`, ou `setError`.
- [ ] Auto-scroll : `canScroll` renvoie `false` quand `overRef.current === "trash"` (ref tenue par
  `onDragOver`).
- [ ] `lead` avec des plats : « Touche un plat pour le changer. Reste appuyé pour le déplacer sur un
  autre, ou le jeter dans la corbeille. Verrouille ce que tu gardes. »
- [ ] `/design`, section « Le planning » : « La corbeille », `TrashZone demo` au repos et au-dessus,
  dans un `DndContext`, une phrase d'explication.
- [ ] E2E téléphone (glisser au doigt par CDP `Input.dispatchTouchEvent` : start, 400 ms, moves, end) :
  proposer ; glisser le dîner de lundi sur la corbeille → carte partie, « Rien de prévu pour … »,
  jour affiché inchangé ; « Annuler » → la carte revient ; idem après « Verrouiller » ; une puce
  dessert (ajoutée par « Dessert, fruit… ») jetée disparaît.
- [ ] `npm test`, `tsc`, `lint`, e2e verts ; commit A.

---

## B : les repas d'une semaine

### Task 4 : migration 0019 et pgTAP

**Files :** Create `supabase/migrations/0019_week_meal_overrides.sql`, `supabase/tests/week_meal_overrides.test.sql` ;
Modify `lib/supabase/database.types.ts` (régénéré).

**Interfaces (produites) :** table `public.week_meal_overrides (id, household_id, week_plan_id, day, meal_type, member_ids uuid[] not null default '{}', created_at, unique (week_plan_id, day, meal_type))` ;
`private.week_slot_members(plan_id uuid, target_day smallint, target_meal_type public.meal_type) returns uuid[]` (stable) ;
`private.trim_week_cards(plan_id uuid, target_day smallint, target_meal_type public.meal_type) returns void` ;
`public.set_week_meal(target_household_id uuid, target_week_start date, target_day smallint, target_meal_type public.meal_type, eater_ids uuid[]) returns void` ;
`public.reset_week_meals(target_household_id uuid, target_week_start date) returns void`.

- [ ] Test pgTAP (deux foyers à soi, comme `planned_meal_eaters.test.sql` ; le premier calqué sur le
  foyer de test) : l'autre foyer ne voit ni n'écrit d'exception, ni par table ni par
  `set_week_meal` ; lundi soir sans Marie-Laure → retirée du duo, son plat céto (elle seule)
  supprimé ; `{}` dimanche soir → exception vide, cartes supprimées ; avec l'ensemble du créneau
  (ordre différent) → exception supprimée ; samedi midi pour tous → exception, `week_slot_members`
  la rend ; `reset_week_meals` → plus d'exception, cartes du samedi midi supprimées ; semaine
  neuve → `week_plans` créée ; suppression de Marie-Laure : l'exception où elle était seule
  disparaît, les autres la perdent, aucune exception vide créée ; `{}` reste `{}`.
- [ ] `supabase test db` → rouge.
- [ ] Migration :
  - trigger `check_week_meal_override` (avant insert/update) : `household_id` recopié de la semaine,
    membres du foyer, sans doublon dans l'ordre donné (comme `check_planned_meal`) ;
  - RLS `for all to authenticated using/with check private.is_household_member(household_id)`, `revoke all … from anon` ;
  - `week_slot_members` : l'exception si elle existe, sinon le créneau du foyer de la semaine, sinon `'{}'` ;
  - `trim_week_cards` : supprime les cartes du repas sans aucun présent (`not member_ids && present`),
    retire les absents des autres (ordre gardé) ; plats et plats légers ;
  - `set_week_meal` (`security invoker`) : refus si pas membre ; semaine créée au besoin ;
    même ensemble que le créneau du foyer (vide si pas de créneau) → delete, sinon upsert ; puis `trim_week_cards` ;
  - `reset_week_meals` : `for … in delete … returning day, meal_type loop perform trim_week_cards …` ;
  - trigger `members_remove_from_week_meal_overrides` (after delete on members) : supprime les
    exceptions égales à `array[old.id]`, retire `old.id` des autres.
- [ ] `supabase db reset` puis `supabase test db` vert ; régénérer les types.

### Task 5 : repas effectifs côté serveur

**Files :** Modify `lib/meal-slots.ts`, `lib/meal-slots.test.ts`, `lib/board.ts`, `lib/board.test.ts`,
`lib/week-data.ts`, `app/(app)/semaine/actions.ts`, `scripts/week-to-sql.ts`.

**Interfaces (produites) :**
- `type WeekOverride = { day: number; meal_type: MealType; member_ids: string[] }`
- `weekSlots(slots: readonly SlotInput[], overrides: readonly WeekOverride[]): SlotInput[]` (sans les vides, tri jour puis `MEAL_TYPES`)
- `type WeekChange = { day: number; meal_type: MealType; kind: "added" | "removed" | "changed"; member_ids: string[]; home_ids: string[] }`
- `weekChanges(slots, overrides): WeekChange[]` (comparaison d'ensembles ; identique → rien ; vide sans créneau → rien)
- `weekMealMessage({ day, meal_type, before, after, home, members }): string` (toast)
- `describeChange(change: WeekChange, members): string` (lignes de la confirmation)
- `trimCards<C>(cards: readonly C[], day: number, mealType: MealType, presentIds: readonly string[]): C[]` (lib/board.ts, même règle que `trim_week_cards`)
- `leavingNote(cards, day, mealType, presentIds, members): string | null` (lib/board.ts, plats seulement)
- `loadWeek` rend en plus `homeSlots`, `overrides`, `changes` ; `slots` = `weekSlots(homeSlots, overrides)`.
- `type WeekMealsResult = { slots: SlotInput[]; changes: WeekChange[]; cards: WeekCard[] } | ActionError` ;
  `setWeekMealAction(weekStart, day, mealType, memberIds)` et `resetWeekMealsAction(weekStart)`.

- [ ] Tests (foyer de test) : `weekSlots` (lundi soir sans Marie-Laure ; samedi midi ajouté ;
  dimanche soir retiré ; tri) ; `weekChanges` (les trois sortes ; exception identique au foyer
  ignorée) ; `weekMealMessage` : « Pas de dîner dimanche cette semaine », « Midi de samedi
  ajouté », « Dîner de lundi : comme d'habitude », « Dîner de lundi : sans Marie-Laure cette
  semaine », « … : avec Timothé cette semaine », « … : changé pour cette semaine » (dans cet ordre
  de priorité) ; `describeChange` (« Dîner de lundi : sans Marie-Laure », « Midi de samedi :
  ajouté », « Pas de dîner dimanche ») ; `trimCards` ; `leavingNote` : « Marie-Laure quittera son
  plat. », « Le plat de Marie-Laure sera retiré. », « Marie-Laure et Olivier quitteront leur
  plat. », « Les plats d'Otis et Anna-Lucia seront retirés. » (élision devant voyelle), les deux
  phrases ensemble, `null` si personne ; `buildBoard` avec des repas effectifs (repas retiré
  absent, repas ajouté présent, ligne « midi » qui apparaît).
- [ ] Rouge ; implémenter ; vert.
- [ ] `loadWeek` lit `week_meal_overrides` du plan. Vérifier une à une `proposeWeekAction`,
  `addDishAction`, `setEatersAction`, `placeRecipeAction`, `addExtrasAction`, `restoreCardAction` :
  elles lisent `slots` (effectifs) → rien à changer. `fridge-settlement`, `shopping-data` lisent
  les plats → rien.
- [ ] Actions : valider jour 0–6, repas de `MEAL_TYPES`, membres du foyer ; `rpc("set_week_meal")` /
  `rpc("reset_week_meals")` ; rendre `loadWeek` frais (slots, changes, cards).
- [ ] `week-to-sql.ts` : les présents viennent de l'exception de la semaine si elle existe (plan
  trouvé), sinon du créneau ; message « ce repas n'a pas lieu cette semaine » ; même chose pour
  la notice « pas de plat pour … ». Régénérer `semaines/2026-11-16.sql` et vérifier qu'il passe en local.

### Task 6 : l'écran « Qui est là ? », un repas en plus, tout remettre

**Files :** Create `components/week-meal-panel.tsx` ; Modify `components/week-components.test.tsx`,
`app/(app)/semaine/week-board.tsx`, `app/(app)/semaine/page.tsx`.

**Interfaces (produites) :**
- `WeekMealPanel({ title, members, selected, onChange, note, changed, choices, meal, onMealChange, onValidate, onNoMeal, onUsual })` :
  `SheetHeader` (`title`, « Pour cette semaine seulement. ») ; si `choices` : `ChoiceChip` radio
  des repas qui n'ont pas lieu ; `EatersPicker` (tous les membres, libellé « Qui est là ? ») ;
  `note` sous les avatars ; « Valider » (« Ajouter » si `choices`), grisé si personne ; hors ajout :
  bouton ghost `Trash2` « Pas de {petit-déj|midi|pique-nique|dîner} ce jour-là » ; si `changed` :
  bouton lien « Comme d'habitude ».
- `MealAttendees({ label, members, onOpen })` : bouton `MemberAvatars size="xs" max={3} decorative`,
  `aria-label` « Qui est là au dîner de lundi ? ».
- `SheetTarget` gagne `{ kind: "meal"; day; meal_type }`, `{ kind: "newMeal"; day }`, `{ kind: "reset" }`.

- [ ] Tests composant : cases cochées = `selected` ; `note` affichée ; « Pas de dîner ce jour-là »
  appelle `onNoMeal` ; « Valider » grisé sans personne ; puces de repas quand `choices`.
- [ ] Rouge ; implémenter ; vert.
- [ ] `WeekBoard` : `slots` et `changes` en état local (props `initialSlots`, `initialChanges`) ;
  `presentAt` et `extrasToAdd` lisent l'état. `renderSlot` : ligne avec `h3` (`MealLabel`, toujours
  `xl:sr-only` sauf pique-nique comme aujourd'hui) + marque « cette semaine » (`text-mustard-deep`,
  petit, visible à toutes les tailles) + `MealAttendees` (visible sur ordinateur aussi).
- [ ] `setWeekMeal(day, mealType, ids)` : optimiste (slots/changes recalculés avec `homeSlots`,
  cartes via `trimCards`), puis la réponse du serveur ; échec → état d'avant + `error`. Toast
  `weekMealMessage`. « Pas de … ce jour-là » envoie `[]`, « Comme d'habitude » envoie `home_ids`.
  `note` = `leavingNote(cards, day, meal, picked, members)`.
- [ ] « + Un repas en plus » : bouton `ghost` (icône `Plus`) en bas de chaque colonne de jour, caché
  si les 4 repas ont lieu ; sur ordinateur, une rangée de grille de plus (`span board.length + 2`).
  Ouvre `newMeal`, premier repas libre présélectionné, tout le monde coché.
- [ ] Sous le sélecteur de semaine, si `changes.length` : « Cette semaine ne suit pas tout à fait le
  foyer · » + bouton lien « Tout remettre comme d'habitude » → `reset` : titre « Tout remettre
  comme d'habitude ? », une ligne `describeChange` par changement, « Les repas ajoutés partent avec
  leurs plats. » s'il y en a, boutons « Tout remettre » / « Annuler ». Toast « Les repas suivent à
  nouveau le foyer ».
- [ ] `page.tsx` passe `initialSlots`, `homeSlots`, `initialChanges`.

### Task 7 : foyer, /design, e2e, CLAUDE.md, commit B et PR

**Files :** Modify `app/(app)/foyer/page.tsx`, `app/bienvenue/repas/page.tsx`, `app/design/page.tsx`
(+ `interactive-demos.tsx`), `CLAUDE.md` ; Create `e2e/repas-semaine.spec.ts`.

- [ ] `/foyer`, sous « Les repas de la semaine » : « C'est le modèle de toutes les semaines. Une
  semaine différente ? Change-la directement dans » + lien « La semaine » (`/semaine`).
- [ ] `/bienvenue/repas` hors parcours : titre « Les repas d'une semaine habituelle ».
- [ ] `/design` : un repas avec la marque « cette semaine » et `MealAttendees`, le panneau
  `WeekMealPanel` (avec phrase « quittera son plat »), « + Un repas en plus ».
- [ ] E2E téléphone (compte neuf Paul + Léa céto, semaine prochaine) : proposer ; lundi soir
  « Qui est là ? », décocher Léa, valider → son plat disparaît, Paul garde le sien ; « Relancer » ne
  lui remet rien ; samedi « + Un repas en plus » → Midi, tous → « Choisir » ; dimanche soir « Pas de
  dîner ce jour-là » → la case disparaît ; « Tout remettre comme d'habitude » → confirmer → tout
  revient, « Rien de prévu pour Léa » lundi soir ; la semaine suivante sans marque « cette
  semaine » ; `/foyer` inchangé (résumé des repas).
- [ ] CLAUDE.md, modèle de données : `week_meal_overrides` (exception d'un repas pour une semaine ;
  `member_ids` vide = pas de repas ; le foyer reste le modèle).
- [ ] `supabase test db`, `npm test`, `tsc`, `lint`, `docker compose run --rm e2e` (toute la suite) ;
  commit B ; push ; `gh pr create` vers `main`.
- [ ] Dire si `week-to-sql.ts` gagnerait à écrire une absence (`"absents": [...]` → `set_week_meal`), sans le faire.
