# Plusieurs plats sur un même repas : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** plusieurs plats par repas, chacun pour certains membres ; duos de même base proposés ; ajout, mangeurs et retrait à la main.

**Architecture:** deux fonctions SQL transactionnelles posent les mangeurs (un présent = un plat) ; le planificateur compare des solutions entières par groupes de régimes ; la grille ajoute un panneau « Pour qui ? / Qui mange ce plat ? » et une zone « + Ajouter un plat ». Les actions renvoient toutes les cartes de la semaine ; l'écran les anticipe avec `moveEaters` (pur).

**Tech Stack:** Next.js 16, Supabase (pgTAP), dnd-kit, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-plusieurs-plats-design.md`

## Global Constraints

- Chaque présent mange un seul plat par repas ; un plat sans mangeur disparaît.
- Réglages : `SAME_BASE_BONUS = 5`, `SAME_PROTEIN_BONUS = 2`, `KETO_FOR_OTHERS_PENALTY = 3`, `EXTRA_CARD_PENALTY = 1`, `BASE_REPEAT_PENALTY = 3`, en tête de `lib/planner.ts`.
- Basiques : seulement dans un duo de même base. Glisser-déposer existant inchangé. RLS inchangée.
- Textes : « + Ajouter un plat », « Pour qui ? », « Qui mange ce plat ? », « Valider », « Retirer ce plat », « Même base : <base en minuscules> », « Touche d'abord qui mange ce plat ».
- Aucun style ad hoc : variantes des composants existants, montrées sur `/design`.

## Review Focus

- Carte verrouillée dans un repas : la proposition ne la touche pas, ses mangeurs ne sont pas resservis, les plats ajoutés préfèrent sa base. → test planner.
- Membre exclu d'une recette (« n'en mange pas ») dans un groupe : la recette du groupe lui convient. → test planner.
- Mettre sur un plat tous les mangeurs d'un autre plat : l'autre disparaît (SQL et `moveEaters`). → pgTAP + Vitest.
- Repas sans aucun duo possible (pas de base commune) : solution par groupe ou repli, chacun servi. → test planner.
- « Autre idée » sur un duo dont l'autre carte est verrouillée : la base reste. → test planner.

---

### Task 1 : fonctions SQL

**Files:** Create `supabase/migrations/0008_planned_meal_eaters.sql`, `supabase/tests/planned_meal_eaters.test.sql` ; regenerate `lib/supabase/database.types.ts`.

**Produces:** `set_planned_meal_eaters(target_card_id uuid, eater_ids uuid[]) returns void` ; `add_planned_meal(target_household_id uuid, target_week_start date, target_day smallint, target_meal_type meal_type, target_recipe_id uuid, eater_ids uuid[]) returns uuid`.

- [ ] pgTAP d'abord : poser les mangeurs retire ces membres de l'autre carte ; vide l'autre → supprimée ; carte verrouillée après ; liste vide refusée (`23514`) ; carte d'un autre foyer refusée (`P0002`) ; membre d'un autre foyer refusé (`23503`) ; `add_planned_meal` crée la semaine, met la carte en dernière position et déplace les mangeurs ; Alice supprime sa carte, pas celle de Bob. Voir échouer, écrire la migration, `supabase db reset && supabase test db` vert, types régénérés, commit.

### Task 2 : planificateur

**Files:** Modify `lib/planner.ts`, `lib/planner.test.ts`.

**Produces:** `PlannerRecipe.base: string | null` ; `proposeWeek` (même signature) ; `nextIdea(...)` rend `{ cardId: string; recipeId: string }[] | null` (une ou deux cartes).

- [ ] Tests d'abord (fixtures : catalogue de test + basiques de deux bases) : lundi soir du foyer de test → deux cartes de même base, la céto pour Marie-Laure seule ; midi de Marie-Laure → une carte céto non basique ; mercredi pique-nique → une carte pour Otis et Anna-Lucia ; foyer sans régime → une carte par repas ; jamais une basique seule ; pas deux fois la même base dans la semaine quand il y a le choix ; même graine → même semaine ; carte verrouillée de base B → la carte ajoutée prend la base B ; membre exclu respecté ; « Autre idée » sur un duo libre → deux recettes d'une autre base ; sur un duo dont l'autre est verrouillée → même base. Voir échouer, implémenter, `npm test` vert, commit.

### Task 3 : actions et logique de la grille

**Files:** Modify `lib/board.ts`, `lib/board.test.ts`, `lib/recipes-data.ts` (rien si `base` y est déjà), `app/(app)/semaine/actions.ts`.

**Produces:** `moveEaters<C>(cards: C[], cardId: string, eaterIds: string[]): C[]` ; `addDishAction(weekStart, target: { day; meal_type }, recipeId, memberIds) → { cards } | error` ; `setEatersAction(weekStart, cardId, memberIds) → { cards } | error` ; `removeCardAction(weekStart, cardId) → { ok } | error` ; `anotherIdeaAction` rend `{ cards: WeekCard[] }` (cartes changées) | `{ none }` | error.

- [ ] Tests `moveEaters` d'abord (déplace, supprime la carte vidée, verrouille, ignore les autres repas), implémenter, actions branchées sur les RPC (membres filtrés sur les présents du créneau, au moins un), `tsc` propre, commit.

### Task 4 : écrans

**Files:** Modify `components/empty-slot.tsx`, `components/member-toggle.tsx`, `components/planned-meal-card.tsx`, `app/(app)/semaine/board-pieces.tsx`, `app/(app)/semaine/week-board.tsx` ; Create `components/eaters-picker.tsx` ; tests `components/week-components.test.tsx`.

**Produces:** `EmptySlot` prop `variant?: "choose" | "add"` ; `MemberToggle` prop `mode?: "exclude" | "pick"` ; `PlannedMealCard` prop `onEaters?: () => void` ; `EatersPicker({ members, selected, onChange, recipe? })` (avatars + alerte « Ne convient pas à … »).

- [ ] Tests composants d'abord : bouton « + Ajouter un plat » ; `MemberToggle` en mode choix (aria-pressed, libellé) ; avatars de carte = bouton séparé ; `EatersPicker` signale un coché qui ne peut pas manger. Implémenter, puis la grille (zone de dépôt `add:`, panneaux « add », « eaters », « Retirer ce plat », ligne « Même base »). `npm test`, commit.

### Task 5 : /design, CLAUDE.md, e2e, captures, build, PR

- [ ] `/design` : variantes ci-dessus et un repas à deux plats liés. CLAUDE.md : phrase exacte sur `week_plans` + `planned_meals`.
- [ ] e2e : nouveau `e2e/plusieurs-plats.spec.ts` (Paul, Léa céto, Timothé) ; existants recalés ; suite complète verte.
- [ ] Captures Pixel 7 et 1440 px ; `npm run lint`, `npm run build` ; commit ; push ; PR vers `recettes-associees`.
