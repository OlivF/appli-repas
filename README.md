# Popote

Les repas de la semaine, sans prise de tête : le planning des repas de toute la famille et la liste de courses. Next.js et Supabase.

## Prérequis

- Docker : Docker Engine dans WSL2, ou Docker Desktop. Le projet doit vivre dans le système de fichiers Linux (`~/...`), pas sous `/mnt/c`.
- [CLI Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started), version 3.2 ou plus récente.

Node.js n'est pas nécessaire sur le poste : il tourne dans le conteneur.

Facultatif : le [CLI GitHub](https://cli.github.com/) (`gh`), pour ouvrir les Pull Requests depuis le terminal (voir [Branches et Pull Requests](#branches-et-pull-requests)). L'appli n'en a pas besoin pour tourner.

## Lancer en local

```bash
supabase start              # Supabase local ; Studio : http://localhost:54323, emails : http://localhost:54324
cp .env.example .env.local  # la première fois seulement
docker compose up           # l'appli : http://localhost:3000
```

Compte de test : `test@example.com`, mot de passe `motdepasse`. Il contient le foyer décrit dans CLAUDE.md.

Les commandes npm se lancent dans le conteneur : `docker compose exec web npm ...`.

## Base de données

Le schéma vit dans `supabase/migrations/`.

```bash
supabase db reset   # repart de zéro : rejoue les migrations, puis supabase/seed.sql
```

Le catalogue commun de recettes vit dans les migrations `0003_recipe_catalog.sql`, `0007_basics_catalog.sql` (les basiques), `0016_light_catalog.sql` (desserts, fruits, fromages) et `0018_week_16_nov_catalog.sql` (menu du 16 novembre) : il part en production avec `supabase db push`. `supabase/seed.sql` ne contient que le compte et le foyer de test, à ne jamais pousser en production.

### Importer un lot de recettes

Un lot de recettes en JSON (même format que `recettes-basiques.json`) devient une nouvelle migration :

```bash
docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  scripts/json-to-catalogue.ts recettes-keto.json supabase/migrations/0008_keto_catalog.sql
supabase db reset   # puis supabase test db
```

Chaque recette reçoit un identifiant fixe, dérivé de son titre, et la migration ignore celles qui existent déjà : on peut la rejouer sans doublon. Une migration déjà poussée en production ne se modifie plus : pour corriger un lot, on en écrit une nouvelle.

### Remplir une semaine depuis un fichier

Un menu décrit dans `semaines/AAAA-MM-JJ.json` (le lundi de la semaine ; recettes par titre, mangeurs par prénom ou `"tous"`) devient un SQL qui pose ces repas, verrouillés, dans la semaine d'un foyer retrouvé par l'email d'un de ses comptes :

```bash
docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  scripts/week-to-sql.ts semaines/2026-11-16.json semaines/2026-11-16.sql --email test@example.com
docker exec -i supabase_db_appli-repas psql -U postgres -v ON_ERROR_STOP=1 < semaines/2026-11-16.sql
```

En production, colle le fichier dans le SQL Editor de Supabase. Tout tient dans une transaction : au premier problème (recette introuvable, prénom inconnu, deux plats pour la même personne…), rien n'est enregistré. Seuls les repas du fichier sont remplacés ; on peut le rejouer. Le SQL contient l'email : `semaines/*.sql` n'est pas commité.

Après un changement de schéma, régénère les types TypeScript :

```bash
supabase gen types typescript --local --schema public > lib/supabase/database.types.ts
```

## Tests

```bash
supabase test db                   # règles d'accès entre foyers (RLS), en SQL
docker compose exec web npm test   # logique et composants (Vitest)
docker compose run --rm e2e        # parcours complets sur téléphone (Playwright), avec docker compose up lancé
```

## Logo et icônes

Le dessin du logo (la cocotte au cœur) vit dans `components/brand/cocotte.ts` ; le composant `<Logo variant="icon" | "full" />` est dans `components/brand/logo.tsx`. Après une retouche du dessin, régénère les icônes (`app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, `public/icons/`) :

```bash
docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/brand-icons.mjs
```

Un test Vitest vérifie que `app/icon.svg` suit le dessin. L'image de partage (`app/opengraph-image.tsx`) se génère au build, avec la police de `app/fonts/`.

## Branches et Pull Requests

Le code vit sur GitHub : `git@github.com:OlivF/appli-repas.git`. Chaque étape de la feuille de route se fait sur sa branche (`etape-2-recettes`…), poussée sur GitHub, puis fusionnée dans `main` par une Pull Request.

```bash
git switch -c etape-3-courses     # une branche par étape
# … commits …
git push -u origin etape-3-courses
gh pr create --base main          # ouvre la Pull Request (titre et description demandés)
```

### Installer `gh` (une fois, dans WSL)

Depuis le dépôt officiel de GitHub (la version des dépôts Ubuntu est trop ancienne) :

```bash
(type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
  && sudo mkdir -p -m 755 /etc/apt/keyrings \
  && out=$(mktemp) && wget -nv -O"$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  && cat "$out" | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && sudo apt update && sudo apt install gh -y
```

### Se connecter (une fois)

```bash
gh auth login
```

Réponds **GitHub.com**, **SSH**, puis **Login with a web browser**. Sous WSL, le navigateur ne s'ouvre pas tout seul : copie le code à 8 caractères affiché, ouvre https://github.com/login/device dans Windows et colle-le.

`gh auth status` doit ensuite afficher ton compte GitHub.
