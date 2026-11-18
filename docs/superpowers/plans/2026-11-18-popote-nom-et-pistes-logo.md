# Popote, partie 1 : nom et pistes de logo — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** renommer l'appli en Popote partout et présenter 3 pistes de logo sur `/design`, puis
s'arrêter pour le choix de l'utilisateur.

**Architecture:** metadata Next.js avec modèle de titre dans `app/layout.tsx` ; les pistes sont des
composants SVG purs (`app/design/logo-options.tsx`), sans dépendance, colorés par
`currentColor` / variables CSS pour passer en monochrome et en mode sombre sans copie.

**Tech Stack:** Next.js 16 (App Router, Cache Components), Tailwind 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-popote-design.md`

## Global Constraints

- Nom : « Popote ». Slogan : « Les repas de la semaine, sans prise de tête. »
- Titre : `{ default: "Popote · Les repas de la semaine, sans prise de tête.", template: "%s · Popote" }`.
- Ne pas renommer les tables ni le dossier ; `project_id` Supabase `appli-repas` inchangé.
- Logo : formes simples et pleines, lisible à 16 px, 2 couleurs au plus (tomate `#E4572E` + brun
  `#2B2118` ; crème `#F6EEE3` sur fond sombre), coins arrondis comme les cartes.
- Textes au tutoiement, en français ; code en anglais.

## Review Focus

- Un onglet de navigateur qui affiche encore « Nos repas » (page oubliée) : chaque `metadata.title`
  ne garde que le titre court.
- Une piste illisible à 16 px : la rangée 16/32/64 px est rendue à la taille réelle, sans mise à
  l'échelle CSS.
- Mode sombre : la version « crème sur chocolat » et les icônes en couleur restent contrastées
  quand `/design` passe en sombre.
- Le test e2e de connexion cherche le titre « Nos repas » : à mettre à jour.

---

### Task 1: Renommage

**Files:**
- Modify: `app/layout.tsx` (metadata), `app/(app)/{semaine,recettes,recettes/nouvelle,recettes/[id]/modifier,courses,foyer}/page.tsx` (titres courts),
  `app/design/page.tsx`, `components/logo.tsx`, `components/screen.tsx`, `app/connexion/auth-page.tsx`,
  `app/(app)/recettes/back-to-list.tsx`, `lib/supabase/config.ts`, `package.json`, `package-lock.json`,
  `README.md`, `CLAUDE.md`, `e2e/connexion.spec.ts`

- [ ] **Step 1:** mettre à jour `e2e/connexion.spec.ts` : titre attendu « Popote ».
- [ ] **Step 2:** remplacer le nom : metadata racine (title par défaut + modèle, description), titres
  courts (`"Recettes"`, `"La semaine"`, `"Nouvelle recette"`, `"Modifier la recette"`, `"Courses"`,
  `"Le foyer"`, `"Le style de Popote"`), libellés « Nos repas » de l'interface, `package.json`
  `name: "popote"` (et la racine de `package-lock.json`), cookie `sb-popote-auth-token`, clé
  `popote:recettes`, README, titre de CLAUDE.md « Popote, appli de planning des repas ».
- [ ] **Step 3:** `grep -rni "nos repas\|nos-repas"` hors `node_modules`, `.next` : seul l'historique
  (specs, plans) peut encore en contenir.
- [ ] **Step 4:** `docker compose exec web npx tsc --noEmit` et `npm test` : PASS.

### Task 2: Les 3 pistes sur `/design`

**Files:**
- Create: `app/design/logo-options.tsx`
- Modify: `app/design/page.tsx` (section « Logo » en tête)

**Interfaces:**
- Produces: `LOGO_OPTIONS: { id: "cocotte" | "assiette" | "calendrier"; name: string; idea: string; Mark: (props: { tone: "color" | "mono"; className?: string }) => JSX.Element }[]`,
  et `LogoOptionsShowcase` (server component) qui rend, par piste : icône à 16, 32, 64 px ;
  logo horizontal ; monochrome brun sur crème et crème sur chocolat ; tuile d'appli tomate arrondie.

- [ ] **Step 1:** dessiner les trois marques en `viewBox="0 0 32 32"` (grille de 16 px × 2), aplats
  pleins, pas de trait fin sous 2 unités.
- [ ] **Step 2:** section « Logo » en tête de `/design`, avant « Couleurs ».
- [ ] **Step 3:** capture Playwright de la section en clair et en sombre, et à 16 px agrandie
  (zoom de l'appareil, pas de mise à l'échelle CSS) pour juger la lisibilité.
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run lint` : PASS. Arrêt : l'utilisateur choisit sa piste.
