# Popote, partie 2 : logo, header, page d'accueil — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** la piste A (cocotte au cœur) devient le logo ; header commun ; page d'accueil publique,
pages légales et Paramètres ; vérification (captures, Lighthouse, build), commit et PR.

**Architecture:** le dessin vit dans un module TS sans dépendance (`components/brand/cocotte.ts`),
lu par le composant React et par un script Node (`scripts/brand-icons.mjs`, Node 26 lit le TS) qui
écrit `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png` et les icônes PWA avec `sharp`
(déjà installé par Next). Le header est rendu une fois dans le layout racine ; la partie liée à la
session est un composant serveur sous `Suspense`. Le proxy décide qui voit `/`.

**Tech Stack:** Next.js 16 (Cache Components), Supabase SSR, Tailwind 4, shadcn (Radix), framer-motion, sharp, `next/og`.

**Spec:** `docs/superpowers/specs/2026-11-18-popote-design.md`

## Global Constraints

- Logo : piste A. Tomate `#E4572E` + brun `#2B2118` ; crème `#F6EEE3` sur fond sombre.
- `<Logo variant="icon" | "full" />` dans `components/brand/`.
- `app/icon.svg`, `app/apple-icon.png` (180 px), `public/icons/icon-192.png`, `public/icons/icon-512.png`,
  `app/opengraph-image.tsx` (1200×630, logo + slogan sur fond crème).
- Header : `components/layout/Header.tsx` ; crème translucide + flou, collant, ombre fine au défilement.
- Accueil : aucune image lourde, pas de faux témoignages, chiffres ou logos de presse ; prénoms inventés.
- Tutoiement, phrases courtes ; tout style passe par les composants et variables de `/design`.

## Review Focus

- Un compte connecté qui ouvre `/` ne doit jamais voir l'accueil clignoter : redirection dans le proxy.
- Un compte au parcours inachevé qui ouvre `/` arrive sur son étape `/bienvenue/...` (via `/semaine`).
- Header sur téléphone 360 px : rien ne déborde (logo + « Se connecter », ou logo + avatar).
- Menu de l'avatar au clavier et au lecteur d'écran : bouton nommé, Échap ferme, focus rendu.
- Changer de mot de passe avec un mot de passe trop court ou identique : message clair, pas d'erreur brute.

---

### Task 1: Le logo et ses fichiers

**Files:** Create `components/brand/cocotte.ts`, `components/brand/logo.tsx`, `scripts/brand-icons.mjs`,
`app/icon.svg`, `app/apple-icon.png`, `public/icons/icon-{192,512}.png`, `app/fonts/fraunces-600-soft.ttf`,
`app/opengraph-image.tsx`. Modify `app/favicon.ico` (régénéré), `app/design/page.tsx` (section Logo :
la piste retenue seule). Delete `components/logo.tsx`, `app/design/logo-options.tsx`.

**Interfaces:**
- `COCOTTE_PARTS: readonly { d: string; color: "tomato" | "brown" }[]` (viewBox `0 0 32 32`).
- `cocotteSvg(colors: { tomato: string; brown: string }, options?: { darkBrown?: string }): string`.
- `Logo({ variant = "full", tone = "color", className }: { variant?: "icon" | "full"; tone?: "color" | "mono"; className?: string })`.

- [ ] Test Vitest `components/brand/cocotte.test.ts` : `app/icon.svg` est identique à
  `cocotteSvg(FAVICON_COLORS, { darkBrown: "#f6eee3" })` (le fichier ne dérive pas du dessin).
- [ ] Script : `docker compose exec web node scripts/brand-icons.mjs` écrit les fichiers ; favicon.ico
  = PNG 16, 32, 48 empaquetés ; tuiles tomate pleine, cocotte crème à 62 %.
- [ ] Police : instance statique Fraunces 600 SOFT 100 (TTF, OFL) téléchargée une fois et commitée.

### Task 2: Header

**Files:** Create `components/layout/Header.tsx`, `components/layout/header-frame.tsx` (client),
`components/layout/account-menu.tsx` (client), `components/ui/dropdown-menu.tsx` (shadcn),
`lib/account.ts` + test. Modify `components/app-nav.tsx` (`SideNav` → `TopNav`), `app/layout.tsx`,
`app/(app)/layout.tsx`, `components/screen.tsx`, `app/design/*` (démo de navigation).

**Interfaces:**
- `accountInitial(email: string | undefined): string` — première lettre en majuscule, « ? » sinon.
- `TopNav({ current?, demo?, onSelect? })` : même contrat que `BottomNav`.

- [ ] Tests Vitest de `accountInitial` (`"olivier@x.fr"` → `"O"`, `"élise@x.fr"` → `"É"`, `undefined` → `"?"`).
- [ ] Invité : logo + « Se connecter » (discret) ; « Créer mon compte » (tomate) dès 640 px. Sur
  `/connexion`, seul le bouton de l'autre page. Connecté : `TopNav` dès 1024 px (masquée sur
  `/bienvenue`), avatar + menu (Mon foyer, Paramètres, Se déconnecter).
- [ ] Barre latérale retirée ; `lg:pl-64` retiré du layout de l'appli.

### Task 3: Accès et redirections

**Files:** Modify `lib/supabase/proxy.ts` (+ `lib/routes.ts` et test), `app/connexion/actions.ts`,
`e2e/connexion.spec.ts`. Delete `app/(app)/page.tsx`.

**Interfaces:** `routeAccess(pathname: string): "guest" | "open" | "private"`.

- [ ] Tests : `/` et `/connexion/inscription` → `guest` ; `/design`, `/mentions-legales`,
  `/confidentialite` → `open` ; `/semaine`, `/parametres`, `/` + rien d'autre → cohérents.
- [ ] Proxy : `guest` + connecté → `/semaine` ; `private` + invité → `/connexion`. Connexion →
  `/semaine` ; déconnexion → `/`.

### Task 4: Page d'accueil, pages légales, Paramètres

**Files:** Create `app/(site)/layout.tsx`, `app/(site)/page.tsx`, `app/(site)/hero-week.tsx` (client),
`app/(site)/mentions-legales/page.tsx`, `app/(site)/confidentialite/page.tsx`,
`components/layout/site-footer.tsx`, `app/(app)/parametres/{page,actions,password-form}.tsx`,
`lib/password.ts` + test.

**Interfaces:** `parseNewPassword(form: FormData): { ok: true; password: string } | { ok: false; error: string }`.

- [ ] Tests de `parseNewPassword` : vide, 5 caractères → erreur ; 6 → ok.
- [ ] Accueil : hero (titre = slogan, phrase, « Créer mon compte gratuit », mini-semaine de vraies
  `PlannedMealCard` qui se posent), 3 étapes, 4 cartes, bandeau tomate (motif de la connexion),
  pied de page. Scène décorative : `aria-hidden` + `inert`.
- [ ] e2e : invité sur `/` voit l'accueil ; connecté sur `/` arrive sur `/semaine` ; menu de
  l'avatar ; changement de mot de passe sur un compte créé pour le test.

### Task 5: Vérification

- [ ] Captures (Pixel 7 et 1440×900, invité et connecté) : accueil, header ouvert/fermé, défilé.
- [ ] `npm run build` ; `next start -p 3001` ; `npx lighthouse` (conteneur e2e) sur `/`.
- [ ] Tous les tests ; commit ; push ; PR.
