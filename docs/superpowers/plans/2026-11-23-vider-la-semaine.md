# Vider la semaine : plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un bouton « Vider la semaine » sur `/semaine` qui, après confirmation, retire tous les plats non verrouillés de la semaine affichée.

**Architecture :** une fonction pure choisit les cartes à retirer (`lib/board.ts`), une action serveur les supprime par id et rend les cartes de la semaine, l'écran ajoute un bouton et un panneau de confirmation, avec une mise à jour optimiste et un retour en arrière si ça échoue.

**Tech Stack :** Next.js (App Router, Server Actions), Supabase (`@supabase/ssr`, RLS), shadcn/ui (Sheet, Button), Sonner, lucide-react, Vitest, Playwright.

**Spec :** `docs/superpowers/specs/2026-11-23-vider-la-semaine-design.md`

## Global Constraints

- Partent : les plats non verrouillés (`!locked && !isExtra(course)`), sur les 7 jours, « Pas cuisiné » compris.
- Restent : plats verrouillés, entrées, desserts, fruits, fromages, laitages, réglages « Qui est là ? ».
- Pas de migration : suppression par id via le client Supabase (RLS `private.is_household_member`).
- La liste de courses n'est pas touchée (le bandeau « Le menu a changé » fait le reste).
- Textes en français, au tutoiement. Composants existants uniquement (Button, Sheet…), pas de style fait à la main.
- Libellés exacts :
  - bouton : `Vider la semaine` (icône `Trash2`, `variant="ghost"`, `text-muted-foreground`) ;
  - panneau : titre `Vider la semaine ?`, texte `{n} plats partent.` / `1 plat part.` suivi de
    `Les plats verrouillés, les entrées, desserts, fruits, fromages et laitages restent.` ;
  - boutons du panneau : `Vider` (`block size="lg"`), `Annuler` (ghost, comme « Tout remettre ») ;
  - toast : `{n} plats retirés` / `1 plat retiré`.
- Tester l'ordinateur à 1280×800 (écran de l'utilisateur).

## Review Focus

- Semaine où il ne reste que des plats verrouillés et des à-côtés : le bouton disparaît (testé en e2e, Tâche 2).
- Échec de l'enregistrement : les plats reviennent à l'écran, l'erreur s'affiche, rien n'est perdu (même chemin que `resetWeek` ; vérifié à la relecture).
- Un autre compte a changé la semaine entre-temps : l'action recharge la semaine côté serveur avant de supprimer, et l'écran prend les cartes rendues (`syncCards`).
- Semaine sans plan (`week_plans` absent) : bouton caché ; l'action rend `{ cards: [] }` sans erreur.
- Sur ordinateur à 1280 px, la ligne « choix de la semaine · Faire les courses · Vider la semaine » tient sans déborder (capture, Tâche 3).

---

### Task 1: choisir les cartes à retirer

**Files :**
- Modify : `lib/board.ts` (après `trimCards`, section « Les repas d'une semaine »)
- Test : `lib/board.test.ts`

**Interfaces :**
- Produces : `clearableCards<C extends { locked: boolean; course?: Course }>(cards: readonly C[]): C[]` (les cartes que « Vider la semaine » retire, dans le même ordre).

- [ ] **Étape 1 : écrire le test qui échoue**, dans `lib/board.test.ts` (ajouter `clearableCards` à l'import) :

```ts
describe("clearableCards", () => {
  it("retire les plats non verrouillés, garde les plats verrouillés et les à-côtés", () => {
    const cards = [
      { id: "a", locked: false, course: "main" as Course },
      { id: "b", locked: true, course: "main" as Course },
      { id: "c", locked: false, course: "dessert" as Course },
      { id: "d", locked: false },
      { id: "e", locked: false, course: "starter" as Course },
      { id: "f", locked: false, course: "fruit" as Course },
      { id: "g", locked: false, course: "cheese" as Course },
      { id: "h", locked: false, course: "dairy" as Course },
    ];
    expect(clearableCards(cards).map((card) => card.id)).toEqual(["a", "d"]);
  });

  it("ne retire rien d'une semaine vide", () => {
    expect(clearableCards([])).toEqual([]);
  });
});
```

- [ ] **Étape 2 : vérifier qu'il échoue**

Run : `docker compose exec web npx vitest run lib/board.test.ts`
Attendu : FAIL, `clearableCards` n'est pas exporté.

- [ ] **Étape 3 : écrire `clearableCards`** dans `lib/board.ts`, avec un commentaire d'une ligne (« Vider la semaine » : les plats non verrouillés ; les à-côtés n'ont pas de cadenas et restent, comme avec « Relancer »). Un `filter` avec `isExtra` (déjà importé).

- [ ] **Étape 4 : vérifier qu'il passe**

Run : `docker compose exec web npx vitest run lib/board.test.ts`
Attendu : PASS.

- [ ] **Étape 5 : commit**

```bash
git add lib/board.ts lib/board.test.ts docs/superpowers/specs/2026-11-23-vider-la-semaine-design.md docs/superpowers/plans/2026-11-23-vider-la-semaine.md
git commit -m "Semaine : choisir les plats que « Vider la semaine » retire"
```

### Task 2: action serveur, bouton, panneau, test e2e

**Files :**
- Modify : `app/(app)/semaine/actions.ts` (après `restoreCardAction`)
- Modify : `app/(app)/semaine/week-board.tsx` (type `SheetTarget` l. ~111-116, gestes à côté de `resetWeek` l. ~620, `weekSheetBody` l. ~789, lignes de boutons l. ~1303-1325, rendu du Sheet l. ~1481)
- Test : `e2e/semaine.spec.ts`

**Interfaces :**
- Consumes : `clearableCards` (Tâche 1) ; dans `actions.ts`, `loadWeek`, `cardsOfWeek`, `isWeekStart`, `SAVE_ERROR`, type `CardsResult`.
- Produces : `clearWeekAction(weekStart: string): Promise<CardsResult>`.

- [ ] **Étape 1 : écrire le test e2e qui échoue**, `test("vider la semaine garde les plats verrouillés et les desserts", …)` dans `e2e/semaine.spec.ts`, avec les helpers du fichier (`newHousehold`, `propose`, `day`, `dinner`) :
  1. `newHousehold(page)`, `propose(page)` ;
  2. `kept = await dinner(page, 0).getAttribute("aria-label")`, puis clic sur « Verrouiller » de cette carte ;
  3. ouvrir le panneau « Ajouter un dessert, un fruit… au dîner de lundi » de `day(page, 0)` (boucle `toPass` comme `openExtras` dans `e2e/desserts.spec.ts`), cliquer `Fromage` puis `Comté`, puis le bouton `Ajouter 1` ; le panneau se ferme ; `day(page, 0)` montre le bouton `/^Fromage : Comté/` ;
  4. clic sur `Vider la semaine` ; le dialog `Vider la semaine ?` contient `/plats? partent?\./` ; clic sur `Vider` ;
  5. attendus : le texte `/plats? retirés?/` est visible ; `day(page, 0).getByRole("group")` a 1 élément, le groupe `kept` (exact) avec « Déverrouiller » ; `Fromage : Comté` toujours là ; `day(page, 1).getByRole("group")` a 0 élément ; le bouton `Vider la semaine` a 0 occurrence ;
  6. `page.reload()` : les mêmes attendus (groupe `kept`, Comté, mardi vide).

- [ ] **Étape 2 : vérifier qu'il échoue**

Run : `docker compose run --rm e2e npx playwright test e2e/semaine.spec.ts -g "vider la semaine"` (avec `docker compose up` lancé)
Attendu : FAIL, pas de bouton « Vider la semaine ».

- [ ] **Étape 3 : écrire `clearWeekAction`** dans `actions.ts`. Commentaire : « Vider la semaine » : les plats non verrouillés partent, le reste demeure. Rend les cartes de la semaine.
  - `weekStart` invalide → `{ error: SAVE_ERROR }` ;
  - `loadWeek(weekStart)` ; pas de `plan` → `{ cards: [] }` ;
  - ids = `clearableCards(cards)` ; vide → `{ cards }` sans écrire ;
  - sinon `supabase.from("planned_meals").delete().in("id", ids)` ; erreur → `{ error: SAVE_ERROR }` ;
  - succès → `{ cards: await cardsOfWeek(supabase, household.id, weekStart) }`.

- [ ] **Étape 4 : brancher l'écran** dans `week-board.tsx` :
  - `SheetTarget` gagne `| { kind: "clear" }` ; `WeekSheet` extrait aussi `"clear"` ; le rendu du Sheet (l. ~1481) passe `"clear"` à `weekSheetBody` ;
  - `const clearable = clearableCards(cards)` ;
  - `async function clearWeek()`, sur le modèle de `resetWeek` : `before = cards`, `setSheet(null)`, `setError(null)`, `setDelays({})`, on retire tout de suite de l'écran les ids de `clearable`, on appelle `clearWeekAction` (`.catch` → `SAVE_ERROR`) ; échec : `setCards(before)` + `setError` ; succès : `syncCards(result.cards, before)` puis le toast (pluriel selon `clearable.length` au moment du clic) ;
  - dans `weekSheetBody`, la branche `"clear"` reprend la forme de la branche `"reset"` (SheetHeader, SheetTitle, SheetDescription, `Vider`, `Annuler`) avec les libellés des contraintes globales ;
  - bouton `Vider la semaine` (`aria-haspopup="dialog"`, ouvre `{ kind: "clear" }`), rendu seulement si `clearable.length > 0` :
    - téléphone : dans le bloc `sm:hidden` (l. ~1322), après `ShoppingLink` ;
    - `sm` et plus : dans la ligne `flex flex-wrap` (l. ~1303), après `ShoppingLink`, en `hidden sm:inline-flex`.

- [ ] **Étape 5 : vérifier que tout passe**

Run : `docker compose run --rm e2e npx playwright test e2e/semaine.spec.ts`
Attendu : PASS, tous les tests de `semaine.spec.ts`, le nouveau compris.

- [ ] **Étape 6 : commit**

```bash
git add "app/(app)/semaine/actions.ts" "app/(app)/semaine/week-board.tsx" e2e/semaine.spec.ts
git commit -m "Semaine : « Vider la semaine » retire les plats non verrouillés"
```

### Task 3: vérification complète, captures, PR

**Files :** aucun nouveau (captures dans le scratchpad, pas dans le dépôt).

- [ ] **Étape 1 : tests et build**
  - `docker compose exec web npm test` → tous verts ;
  - `docker compose exec web npx tsc --noEmit` et `docker compose exec web npm run lint` → sans erreur ;
  - `docker compose exec web npm run build` → réussi ;
  - `docker compose run --rm e2e` → toute la suite verte (si c'est instable, voir la mémoire « E2E memory pressure » : redémarrer `web`, faire chauffer, relancer).
- [ ] **Étape 2 : captures** avec un script Node + Playwright dans le service `e2e` : téléphone (Pixel 7) et ordinateur 1280×800, une semaine proposée avec un plat verrouillé, le bouton visible, puis le panneau ouvert. Vérifier qu'à 1280 px la ligne tient sans déborder.
- [ ] **Étape 3 : PR** : `git push -u origin vider-la-semaine` puis `gh pr create --base main`. Titre `Semaine : vider la semaine (plats non verrouillés)` ; dans la description : le résumé, les tests lancés et la ligne d'attribution.
