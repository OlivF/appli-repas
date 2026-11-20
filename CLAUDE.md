# Popote, appli de planning des repas

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

- Toute table métier porte un `household_id` et une politique RLS `private.is_household_member` : un utilisateur ne voit que les foyers dont il est membre.
- Seuls les admins gèrent les comptes et les invitations (`private.is_household_admin`).
- Le schéma vit dans `supabase/migrations/*.sql`, jamais modifié à la main dans le dashboard.
- Variables d'env dans `.env.local` (jamais commitées) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. En dev Docker, `SUPABASE_INTERNAL_URL` (dans `docker-compose.yml`) remplace l'URL côté serveur ; absente en prod.
- Textes de l'interface en français, au tutoiement ; code et noms de tables en anglais.
- Simplicité avant tout : peu d'écrans, gros boutons, zéro jargon.

## Design

- Direction « cuisine de famille » : chaleureux, gourmand, mobile d'abord. Détail dans PROMPT-design.md ; la page `/design` fait référence.
- shadcn/ui avec thème personnalisé (toasts : Sonner), framer-motion pour les micro-animations, lucide-react pour les icônes.
- Couleurs en variables CSS (fond crème, tomate, sauge, moutarde, prune), mode sombre prévu. Titres Fraunces, texte Inter.
- Chaque nouvel écran réutilise les composants existants ; pas de style ad hoc.

## Modèle de données (cible)

- `households` : un foyer. `household_users` : les comptes qui organisent le foyer (rôle `admin` : peut inviter et retirer, ou `member`), un compte n'a qu'un foyer, au moins un admin, le foyer disparaît avec son dernier compte ; `member_id` facultatif (« C'est moi », pour l'affichage seulement). Un compte n'est pas un mangeur : les mangeurs sont dans `members`. `household_invites` : code à usage unique, 7 jours, partagé par lien `/rejoindre/<code>`. Toutes les écritures sur les comptes passent par des fonctions `security definer`.
- `members` : membres du foyer (prénom, année de naissance, régimes `keto` | `vegetarian` | `gluten_free` | `lactose_free`, appétit `normal` | `grand` → coefficient de portion 1 / 1.5, enfant < 12 ans → 0.7). Le formulaire demande l'âge.
- `meal_slots` : créneaux configurables (jour 0 = lundi … 6 = dimanche, type `petit_dej` | `midi` | `soir` | `pique_nique`, `member_ids` : membres présents du même foyer ; un créneau vide n'existe pas).
- `recipes` : titre, type(s) de repas, portions de base, préparable à l'avance (batch), temps, régimes compatibles, membres exclus. base : élément principal (steak haché, poulet…) ; deux recettes de même base s'associent et se cuisinent ensemble. basic : recette du panneau Les basiques. `course` : sorte (`main` plat, `starter` entrée, `dessert`, `fruit`, `cheese` fromage, `dairy` laitage). Recette légère : un ingrédient, une portion (Yaourt nature, Comté).
- `recipe_ingredients` : nom, quantité, unité, rayon.
- `ingredients` : référentiel d'ingrédients canoniques (commun + propres au foyer) : nom, rayon, unité d'achat, poids d'une pièce, densité, alias, placard. `recipe_ingredients.ingredient_id` y renvoie. Base commune de la liste de courses, du frigo et du menu IA.
- `week_plans` + `planned_meals` : semaine (date du lundi), créneau → recette, verrou. Un repas peut porter plusieurs plats (2 ou 3), chacun pour certains membres ; chaque présent mange un seul **plat** par repas. Entrées, desserts, fruits, fromages et laitages : autant qu'on veut, chacun pour certains membres, jamais touchés par la proposition auto. Le planner privilégie les duos de même base (plat famille + plat keto).
- `shopping_lists` + `shopping_items` : une liste par semaine (signatures du menu et du frigo pour savoir si elle est à jour), partagée par les comptes du foyer, mise à jour en direct entre les comptes (Supabase Realtime). Articles : ingrédient canonique, quantités dans l'unité d'achat (`amounts`), rayon, placard, sources (recette, jour, repas, convives), coché, « J'en ai déjà » (`removed`), ajouté à la main, part prise au frigo (`from_fridge`). Desserts, fruits, fromages et laitages : une portion par mangeur, sans coefficient. Calcul pur dans `lib/shopping.ts` ; jamais de mise à jour automatique : bandeau « Le menu a changé » ou « Le frigo a changé ».
- `fridge_items` : ce qu'on a à la maison (ingrédient canonique ou texte libre, quantité dans l'unité d'achat ou inconnue, date limite, origine : à la main, courses, reste de plat). Libre (un reste) ou réservé à la liste d'une semaine. La liste de courses déduit le stock libre et réserve ce qu'elle prend (shopping_items.from_fridge) ; le bilan de fin de semaine retire ce qui a été cuisiné (planned_meals.skipped = pas cuisiné). Calcul pur dans lib/fridge.ts ; fridgeForMenu est le contrat pour le menu IA.

## Feuille de route

1. Socle : auth, création du foyer, membres, créneaux, déploiement Vercel.
2. Recettes (CRUD + catalogue de base) et grille de la semaine avec proposition auto et glisser-déposer.
3. ✅ Liste de courses (quantités ajustées aux convives, regroupées par rayon, à cocher / copier).
3 bis. ✅ Dans le frigo (restes, dates limites, déduits de la liste de courses).
3 ter. ✅ Foyer partagé entre plusieurs comptes (invitation par lien, liste de courses en direct).
4. Génération du menu par IA (privilégie les restes à finir).
5. Batch cooking du dimanche, PWA installable.

## Foyer de test

Olivier (40 ans), Marie-Laure (40 ans, cétogène), Timothé (16 ans, sportif, grand appétit), Anna-Lucia (9 ans), Otis (6 ans).
Comptes : Olivier et Marie-Laure (tous deux admins). Les trois enfants n'ont pas de compte.
Créneaux : petit-déj et dîner pour tous les jours ; midi Marie-Laure lun/mar/jeu/ven (keto) ; mercredi midi Otis + Anna-Lucia en pique-nique rapide.
Rituel : menu de la semaine suivante préparé le lundi, drive récupéré le jeudi, batch cooking le dimanche.
