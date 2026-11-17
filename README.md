# Nos repas

Le planning des repas de la semaine pour toute la famille. Next.js et Supabase.

## Prérequis

- Docker : Docker Engine dans WSL2, ou Docker Desktop. Le projet doit vivre dans le système de fichiers Linux (`~/...`), pas sous `/mnt/c`.
- [CLI Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started), version 3.2 ou plus récente.

Node.js n'est pas nécessaire sur le poste : il tourne dans le conteneur.

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
