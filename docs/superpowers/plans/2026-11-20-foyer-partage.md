# Foyer partagé : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** plusieurs comptes organisent le même foyer : invitation par lien, gestion des comptes,
liste de courses en direct.

**Architecture :** toutes les écritures sur les comptes et les invitations passent par des
fonctions Postgres `security definer` (migration 0013) ; l'appli les appelle par Server Actions et
traduit leurs `errcode` (`lib/household-accounts.ts`). Les tables métier ne changent pas : leur RLS
passe déjà par `private.is_household_member`.

**Tech Stack :** Supabase (Postgres, pgTAP, Realtime), Next.js 16 App Router, Vitest, Playwright.

**Spec :** `docs/superpowers/specs/2026-11-20-foyer-partage-design.md`

## Global Constraints

- Branche `foyer-partage` depuis `main` (39fd6a9) ; arrêt après A et après B ; PR vers `main` après C.
- Migrations `0013_household_accounts.sql` (A) et `0014_shopping_realtime.sql` (C) ; jamais de schéma à la main.
- Types : `supabase gen types typescript --local --schema public > lib/supabase/database.types.ts`.
- Alphabet des codes : `ABCDEFGHJKMNPQRSTUVWXYZ23456789` ; 8 caractères ; affichage `7KQM-3FXP`.
- Fonctions : `security definer`, `set search_path = ''`, `revoke … from public, anon`, `grant … to authenticated` (preview : aussi `anon`).
- Interface : tutoiement, jamais « admin », « rôle », « compte membre » ; code et tables en anglais.
- Tests : `supabase test db`, `docker compose exec web npm test`, `docker compose run --rm e2e`.

## Review Focus

- Suppression d'un foyer complet (recettes, semaine, liste, frigo, invitations) déclenchée par le
  départ du dernier compte : les triggers « set null » du frigo ne doivent pas la bloquer → test
  pgTAP « dernier compte qui part » sur un foyer rempli.
- Code tapé à la main avec tirets, espaces, minuscules, tiret long du téléphone (`–`) → reconnu,
  en SQL comme en TS (tests pgTAP et Vitest de normalisation).
- Deux acceptations du même code en même temps → une seule réussit (verrou `for update` ;
  test pgTAP « un code ne sert qu'une fois »).
- Compte retiré qui garde un lien qu'il avait créé → lien annulé (test pgTAP).
- Double envoi du formulaire « Nom du foyer » → pas de second foyer (`HA001`, test pgTAP).

---

## A : les données

### Task 1 : migration 0013 et tests pgTAP

**Files :**
- Create : `supabase/migrations/0013_household_accounts.sql`
- Create : `supabase/tests/household_accounts.test.sql`
- Modify : `supabase/seed.sql`, `lib/supabase/database.types.ts` (régénéré)

**Interfaces (produites) :**
- `household_role` = `'admin' | 'member'` ; `household_users.role`, `.member_id`, `.member_chosen_at`.
- `household_invites` (lecture admin seulement).
- RPC : `create_household(household_name) → uuid`,
  `create_household_invite(target_household_id, invite_role?) → {code, expires_at}[]`,
  `revoke_household_invite(invite_id) → void`, `set_household_invite_role(invite_id, new_role) → void`,
  `household_invite_preview(invite_code) → {household_name, inviter_name, status, is_member}[]`,
  `accept_household_invite(invite_code, leave_current?) → uuid`,
  `household_accounts() → {user_id, email, role, member_id, member_chosen_at, joined_at, is_me}[]`,
  `set_household_role(target_user_id, new_role)`, `remove_household_account(target_user_id)`,
  `leave_household()`, `set_my_member(target_member_id)` → `void`.
- errcodes : `HA001` déjà dans un foyer, `HA002` invitation invalide, `HA003` dernier admin,
  `HA004` 5 invitations actives, `HA005` se retirer soi-même, `42501`, `P0002`, `23505`.

- [ ] Écrire `household_accounts.test.sql` (scénarios de la spec, section « Tests pgTAP »).
- [ ] `supabase test db` : échec attendu (fonctions absentes).
- [ ] Écrire la migration : garde « un compte = un foyer » (exception claire, rien supprimé),
  colonnes, uniques, trigger mangeur du même foyer, `is_household_admin`, `new_invite_code`
  (tirage par rejet sur `gen_random_bytes`, octets < 248), `normalize_invite_code`, table et RLS
  des invitations, fonctions, trigger `after delete` (annule les invitations de l'auteur, supprime
  le foyer vide, promeut le plus ancien), `revoke insert, update, delete` sur `household_users`.
- [ ] Seed : `test@example.com` admin « C'est moi » Olivier (arrivé en premier),
  `marie-laure@popote.test` admin « C'est moi » Marie-Laure, `invite@popote.test` sans foyer.
- [ ] `supabase db reset`, `supabase test db` : tout passe (anciens tests compris).
- [ ] Régénérer les types.

### Task 2 : `lib/household-accounts.ts` et Vitest

**Files :** Create `lib/household-accounts.ts`, `lib/household-accounts.test.ts` ; Modify
`lib/fridge-items.ts` (exporter le découpage jour / mois si réutilisé).

**Interfaces (produites) :**
- `INVITE_ALPHABET`, `normalizeInviteCode(raw: string): string | null`,
  `formatInviteCode(code: string): string`, `inviteUrl(origin: string, code: string): string`,
  `inviteShareText(householdName: string, url: string): string`.
- `type HouseholdAccount = { user_id; email; role: HouseholdRole; member_id: string | null; member_chosen_at: string | null; joined_at: string; is_me: boolean }`.
- `accountLabel(account: Pick<HouseholdAccount, "email" | "member_id">, members: { id: string; first_name: string }[]): string`.
- `inviteExpiryLabel(expiresAt: string, today: string): string` (heure de Paris).
- `canManageAccounts(role: HouseholdRole | null | undefined): boolean`.
- `leaveConsequence({ accountCount, isLastAdmin }): "delete_household" | "promote_oldest" | "leave"`.
- `accountErrorKind(code: string | undefined): AccountErrorKind`.

- [ ] Tests : `" 7kqm-3fxp "` → `"7KQM3FXP"` ; `"7KQM–3FXP"` → `"7KQM3FXP"` ; `"7KQM3FX0"`,
  `"7KQM3FX"` → null ; `formatInviteCode("7KQM3FXP")` → `"7KQM-3FXP"` ; texte de partage exact du
  prompt ; libellé prénom / email ; « Valable jusqu'au jeu. 26 nov. », « Valable jusqu'à demain »,
  « Valable encore aujourd'hui », passage minuit heure de Paris ; trois conséquences ; codes connus
  et inconnus.
- [ ] `docker compose exec web npm test` : échec, puis implémentation, puis succès.
- [ ] Commit A (spec, plan, migration, seed, types, lib, tests).

## B : les écrans (détaillé à l'ouverture de B)

`/foyer` (« À table », « Qui organise les repas », panneau d'invitation, carte « Qui es-tu à
table ? », panneau d'un compte, « Quitter ce foyer »), `/rejoindre/[code]` (OPEN_PATHS, cookie
`popote_invite`), champ code sur `/bienvenue`, Server Actions `app/(app)/foyer/actions.ts` et
`app/rejoindre/actions.ts`, illustration « table pour deux », section `/design`, captures, build,
commit.

## C : en direct, CLAUDE.md, e2e (détaillé à l'ouverture de C)

`0014_shopping_realtime.sql`, `useLiveShoppingList`, `applyLiveChange` (Vitest),
`loadListItemsAction`, indicateur « En direct » / « Hors ligne », `e2e/realtime-rls.spec.ts`,
`e2e/foyer-partage.spec.ts`, CLAUDE.md, captures, build, commit, PR.
