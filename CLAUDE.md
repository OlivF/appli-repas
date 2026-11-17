# Appli de planning des repas

Appli web multi-utilisateurs : chaque compte crée son foyer, ses membres, ses recettes, puis planifie la semaine et génère la liste de courses. Interface en français, très simple, pensée d'abord pour le téléphone.

## Stack

- Next.js (App Router, TypeScript), Tailwind CSS
- Supabase : Postgres, Auth (email + Google), Row Level Security
- Déploiement : Vercel (offre gratuite)
- Glisser-déposer : dnd-kit
- Pas d'autre backend : Server Actions Next.js + client Supabase (`@supabase/ssr`)

## Environnement de dev (Docker)

- Tout le dev local tourne dans Docker, rien d'autre à installer que Docker et le CLI Supabase (3.2 ou plus).
- Supabase local : `supabase start` (le CLI lance Postgres, Auth, Studio sur http://localhost:54323 et Mailpit pour lire les emails de test sur http://localhost:54324). Les migrations de `supabase/migrations` sont appliquées automatiquement ; `supabase db reset` repart de zéro et rejoue `supabase/seed.sql`.
- Appli Next.js : service `web` dans `docker-compose.yml` (image node:26, utilisateur `node`, code monté en volume, `npm run dev` sur le port 3000, `node_modules` dans un volume nommé). Depuis le conteneur, Supabase est joignable via `http://host.docker.internal:54321` (`extra_hosts: host.docker.internal:host-gateway`) : c'est `SUPABASE_INTERNAL_URL`, utilisée côté serveur seulement. Le navigateur, lui, passe par `http://127.0.0.1:54321`.
- Tests : `supabase test db` (RLS, pgTAP), `docker compose exec web npm test` (Vitest), `docker compose run --rm e2e` (Playwright, avec `docker compose up` lancé).
- Lancer : `supabase start` puis `docker compose up`. Commandes npm : `docker compose exec web npm ...`.
- En production : Supabase cloud + Vercel, pas de Docker.
- Poste de dev : Windows + WSL2 (Ubuntu) + Docker Engine installé dans WSL (pas Docker Desktop). Le projet vit dans le système de fichiers Linux (`~/...`), jamais sous `/mnt/c`. Si le rechargement à chaud ne réagit pas, ajouter `WATCHPACK_POLLING=true` au service `web`.

## Règles

- Toute table métier porte un `household_id` et une politique RLS : un utilisateur ne voit que les foyers dont il est membre.
- Le schéma vit dans `supabase/migrations/*.sql`, jamais modifié à la main dans le dashboard.
- Variables d'env dans `.env.local` (jamais commitées) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. En dev Docker, `SUPABASE_INTERNAL_URL` (dans `docker-compose.yml`) remplace l'URL côté serveur ; absente en prod.
- Textes de l'interface en français, au tutoiement ; code et noms de tables en anglais.
- Simplicité avant tout : peu d'écrans, gros boutons, zéro jargon.

## Modèle de données (cible)

- `households` : un foyer. `household_users` : comptes liés à un foyer (pour partager entre conjoints).
- `members` : membres du foyer (prénom, année de naissance, régimes `keto` | `vegetarian` | `gluten_free` | `lactose_free`, appétit `normal` | `grand` → coefficient de portion 1 / 1.5, enfant < 12 ans → 0.7). Le formulaire demande l'âge.
- `meal_slots` : créneaux configurables (jour 0 = lundi … 6 = dimanche, type `petit_dej` | `midi` | `soir` | `pique_nique`, `member_ids` : membres présents du même foyer ; un créneau vide n'existe pas).
- `recipes` : titre, type(s) de repas, portions de base, préparable à l'avance (batch), temps, régimes compatibles, membres exclus.
- `recipe_ingredients` : nom, quantité, unité, rayon.
- `week_plans` + `planned_meals` : semaine (date du lundi), créneau → recette, verrou.

## Feuille de route

1. Socle : auth, création du foyer, membres, créneaux, déploiement Vercel.
2. Recettes (CRUD + catalogue de base) et grille de la semaine avec proposition auto et glisser-déposer.
3. Liste de courses (quantités ajustées aux convives, regroupées par rayon, à cocher / copier).
4. Batch cooking du dimanche, PWA installable.

## Foyer de test

Olivier (40 ans), Marie-Laure (40 ans, cétogène), Timothé (16 ans, sportif, grand appétit), Anna-Lucia (9 ans), Otis (6 ans).
Créneaux : petit-déj et dîner pour tous les jours ; midi Marie-Laure lun/mar/jeu/ven (keto) ; mercredi midi Otis + Anna-Lucia en pique-nique rapide.
Rituel : menu de la semaine suivante préparé le lundi, drive récupéré le jeudi, batch cooking le dimanche.
