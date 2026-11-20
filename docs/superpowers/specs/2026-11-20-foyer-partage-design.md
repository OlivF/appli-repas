# Étape 3 ter : foyer partagé entre plusieurs comptes : design

Validé le 2026-11-20 (« go »). Complète CLAUDE.md et la charte de `/design`. Source : le prompt
A/B/C de l'utilisateur (2026-11-20), ses réponses ci-dessous, et les choix de Claude marqués
*(choix)*.

## Intention

Olivier crée le foyer, envoie un lien à Marie-Laure par WhatsApp ou SMS ; elle crée son compte en
un clic depuis ce lien et voit tout de suite les mêmes recettes, la même semaine, la même liste de
courses et le même frigo. Au drive, quand l'un coche les œufs, l'autre les voit cochés. Usage
réel : un soir, depuis le canapé, au téléphone ; elle doit être dans le foyer en moins d'une
minute sans rien comprendre de technique.

Deux notions à ne jamais mélanger (code, textes, tests) :

- **Les mangeurs** (`members`) : âge, régimes, appétit ; pas de compte. La semaine et la liste les
  servent.
- **Les comptes** (`household_users`) : les adultes qui organisent, avec email et mot de passe. Un
  compte ne mange pas. Il peut dire « C'est moi » sur un mangeur (facultatif) : seulement pour
  afficher un prénom au lieu d'un email. Rien ne change aux repas, portions ni régimes.

## Objectifs

- **A** : migration `0013_household_accounts.sql` (rôles, « C'est moi », un compte = un foyer,
  invitations, fonctions, triggers), seed à trois comptes, types régénérés,
  `lib/household-accounts.ts`, pgTAP et Vitest.
- **B** : `/foyer` en deux sections (« À table », « Qui organise les repas »), panneau
  d'invitation, carte « Qui es-tu à table ? », panneau d'un compte, « Quitter ce foyer »,
  `/rejoindre/[code]`, cookie `popote_invite`, champ code sur `/bienvenue`, section `/design`.
- **C** : liste de courses en direct (Realtime), CLAUDE.md, e2e, captures, PR.

## Non-objectifs

- Pas de sélecteur de foyer : un compte n'a qu'un foyer.
- Aucun email envoyé par l'appli : partage natif du téléphone.
- Pas de temps réel ailleurs que sur la liste de courses (les bandeaux existants suffisent).
- Pas de connexion Google (pas encore codée) : le cookie ne concerne que connexion et inscription.

## Anti-objectifs

- Un écran qui dit « admin », « rôle » ou « compte membre ».
- Une politique RLS métier réécrite : toutes passent déjà par `private.is_household_member`.
- Une écriture directe sur `household_users` ou `household_invites` depuis l'API.
- Une migration qui supprime des données pour passer la contrainte « un compte = un foyer ».
- Un compte retiré qui revient par un lien gardé de côté.
- Un toast à chaque coche de l'autre au drive.

## Décisions de l'utilisateur

Du prompt : un compte = un foyer (unique `user_id`) ; rôles `admin` (inviter, retirer, changer un
rôle) et `member` (tout le reste) ; invitation en `admin` par défaut ; toujours au moins un admin
(le plus ancien est promu) ; le foyer disparaît avec son dernier compte ; code de 8 caractères
(alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`), 7 jours, usage unique, révocable, 5 actifs au plus ;
lien `/rejoindre/<code>`.

Questions du 2026-11-20 :

| Sujet | Choix |
| --- | --- |
| Savoir si le compte connecté est déjà dans le foyer de l'invitation | `household_invite_preview` rend aussi `is_member` (faux en anonyme) |
| Interrupteur « Pourra aussi inviter » après création du code | Même code : nouvelle fonction `set_household_invite_role` |
| Retenir « Je ne mange pas ici » | Colonne `household_users.member_chosen_at`, remplie par `set_my_member` même avec null |
| Invitations d'un compte qui part, est retiré ou perd le droit d'inviter | Annulées automatiquement (`revoked_at`) |
| Tester que la RLS filtre les événements Realtime | `e2e/realtime-rls.spec.ts`, supabase-js sans navigateur dans le conteneur e2e |
| Illustration de `/rejoindre` | Nouvelle : la table pour deux, même style que les cinq existantes |
| Déroulé | Branche `foyer-partage` depuis `main` ; arrêt après A et après B ; PR à la fin de C |

## Approches

Une seule voie raisonnable, retenue : toutes les écritures sur les comptes et les invitations
passent par des fonctions `security definer` (`search_path = ''`), l'appli les appelle et traduit
leurs erreurs. La RLS ne sait pas exprimer « rejoindre un foyer dont on n'est pas encore membre
grâce à un code », et il faut des transactions (verrou de l'invitation, départ de l'ancien foyer,
rattachement). Écartées : la clé service côté Next.js (CLAUDE.md : pas d'autre backend, et l'appli
n'a pas cette clé) ; des politiques `insert` sur `household_users` conditionnées par une
invitation (contournables, et sans transaction pour l'usage unique).

## A : les données

### Schéma (`0013_household_accounts.sql`)

- Type `household_role` (`admin` | `member`).
- `household_users` :
  - `role household_role not null default 'member'` ; les lignes existantes passent `admin`.
  - `member_id uuid references members (id) on delete set null` : le « C'est moi ».
  - `member_chosen_at timestamptz` : date de la réponse à « Qui es-tu à table ? » (null : jamais
    répondu ; non null avec `member_id` null : « Je ne mange pas ici »).
  - Unique `(user_id)`. Avant de la poser, la migration lève une exception claire si un compte est
    dans plusieurs foyers (rien n'est supprimé). En local : 58 comptes, aucun doublon.
  - Unique partiel `(member_id) where member_id is not null`.
  - Trigger `before insert or update of member_id, household_id` : le mangeur appartient au même
    foyer (`foreign_key_violation`).
  - L'index `household_users_user_id_idx` est supprimé (couvert par l'unique) *(choix)*.
- `household_invites` : `id`, `household_id` (cascade), `code` (unique, 8 caractères de
  l'alphabet, `check`), `role` (défaut `admin`), `created_by` (FK `auth.users`, set null),
  `created_at`, `expires_at` (défaut `now() + 7 days`), `used_by` (FK `auth.users`, set null),
  `used_at`, `revoked_at`. RLS : lecture par les admins du foyer seulement ; aucune politique
  d'écriture ; `revoke all … from anon`.
- `household_users` reste en lecture seule pour l'API (politique `select` existante).

### Fonctions

`private.is_household_admin(target_household_id)` sur le modèle de `is_household_member`.

Toutes `public`, `security definer`, `search_path = ''`, `revoke … from public, anon`,
`grant … to authenticated` (sauf la preview, aussi à `anon`) :

| Fonction | Rôle |
| --- | --- |
| `create_household(name)` | Rattache le créateur en `admin` ; refuse si le compte a déjà un foyer |
| `create_household_invite(household, role default 'admin') → (code, expires_at)` | Admin ; 5 invitations actives au plus |
| `revoke_household_invite(invite_id)` | Admin |
| `set_household_invite_role(invite_id, role)` | Admin ; invitation encore valide |
| `household_invite_preview(code) → (household_name, inviter_name, status, is_member)` | Anon aussi ; code normalisé ; rien d'autre (ni id, ni email) |
| `accept_household_invite(code, leave_current default false) → household_id` | Verrou `for update` ; déjà dans ce foyer : rien, rend l'id ; autre foyer : erreur sans `leave_current`, sinon départ d'abord |
| `household_accounts() → (user_id, email, role, member_id, member_chosen_at, joined_at, is_me)` | Comptes du foyer de l'appelant, par ordre d'arrivée |
| `set_household_role(user, role)` | Admin ; jamais retirer le dernier admin |
| `remove_household_account(user)` | Admin ; pas soi-même |
| `leave_household()` | Le compte connecté part |
| `set_my_member(member_id)` | « C'est moi » (null pour « Je ne mange pas ici ») ; remplit `member_chosen_at` |

Statut d'une invitation, dans cet ordre : `used`, `revoked`, `expired`, `valid` ; code introuvable
ou mal formé : `unknown` *(choix)*. Invitation « active » (limite de 5) : ni utilisée, ni annulée,
ni expirée. `inviter_name` : prénom du « C'est moi » de `created_by` s'il est encore dans le foyer,
sinon null. Pour un code qui ne marche plus, la preview ne rend ni le nom du foyer ni l'invitant
(l'écran n'en dit rien de toute façon) *(choix)*.

Code généré avec `extensions.gen_random_bytes` et tirage par rejet (octets < 248, modulo 31 : aucun
caractère favorisé), nouvel essai en cas de collision *(choix)*. Normalisation : majuscules, espaces
et tirets retirés.

### Triggers « au moins un admin » et « dernier compte »

`after delete on household_users` (couvre aussi la suppression d'un compte Supabase), en
`security definer` : invitations en attente créées par ce compte annulées ; plus aucun compte → le
foyer est supprimé (la cascade emporte tout) ; plus aucun admin → le compte arrivé le premier
(`created_at`, puis `user_id`) devient admin. `set_household_role` vers `member` annule aussi les
invitations en attente de ce compte.

### Erreurs *(choix)*

Messages en français ; `errcode` exploitable par l'appli :

| errcode | Sens (`accountErrorKind`) |
| --- | --- |
| `HA001` | `already_in_household` : « Tu fais déjà partie d'un foyer » |
| `HA002` | `invalid_invite` : lien expiré, utilisé, annulé ou inconnu |
| `HA003` | `last_admin` : il faut garder quelqu'un qui peut inviter |
| `HA004` | `too_many_invites` : 5 invitations en attente |
| `HA005` | `cannot_remove_self` : pour soi, c'est « Quitter ce foyer » |
| `42501` | `not_allowed` : connexion requise ou pas le droit d'inviter |
| `P0002` | `not_found` : compte, invitation ou mangeur introuvable dans ce foyer |
| `23505` | `member_taken` : ce mangeur est déjà le « C'est moi » d'un autre compte |

### Seed

`test@example.com` (Olivier, inchangé) devient `admin`, « C'est moi » = Olivier, arrivé en premier.
`marie-laure@popote.test` (mot de passe `motdepasse`), `admin` du foyer de test, « C'est moi » =
Marie-Laure. `invite@popote.test` (`motdepasse`) sans foyer, pour l'e2e.

### `lib/household-accounts.ts` (pur, Vitest)

`normalizeInviteCode`, `formatInviteCode` (`7KQM-3FXP`), `inviteUrl`, `inviteShareText`,
`accountLabel` (prénom du « C'est moi », sinon l'email ; avatar : `accountInitial`),
`inviteExpiryLabel(expiresAt, today)` (heure de Paris : « Valable jusqu'au jeu. 26 nov. », mois
toujours affiché ; « Valable jusqu'à demain » ; « Valable encore aujourd'hui ») *(choix)*,
`canManageAccounts(role)`, `leaveConsequence({ accountCount, isLastAdmin })` →
`delete_household` | `promote_oldest` | `leave`, `accountErrorKind(code)` *(choix)*.

### Tests pgTAP (`household_accounts.test.sql`)

Trois comptes (Olivier admin, Marie-Laure, un inconnu) : un member ne crée pas d'invitation ;
l'inconnu ne lit pas les invitations ; preview anonyme des cinq statuts, sans email ni id ;
acceptation puis Marie-Laure voit recettes, semaine, liste et frigo ; usage unique ; autre foyer :
échec sans `leave_current`, succès avec (ancien foyer à un seul compte supprimé) ; pas d'insertion
directe dans `household_users` ; dernier admin qui part → l'autre est promu ; dernier compte qui
part → foyer supprimé avec tout son contenu ; compte retiré ne voit plus rien ;
`household_accounts()` limité à son foyer ; invitations annulées au départ de leur auteur ;
`set_household_invite_role` ; `set_my_member` (autre foyer refusé, déjà pris refusé, null retenu).

## B : les écrans (rappel des choix)

Le prompt fait foi ; s'y ajoutent *(choix)* : la carte « Qui es-tu à table ? » ne propose que les
mangeurs qui ne sont le « C'est moi » de personne ; chaque toucher sur « Inviter quelqu'un » crée un
code, et toucher une invitation en attente rouvre le panneau avec son code ; le cookie
`popote_invite` est posé par une Server Action derrière « Créer mon compte » / « J'ai déjà un
compte » ; nouvelle illustration « table pour deux ».

Décisions de l'utilisateur pour B (2026-11-20) : toute la page `/foyer` passe à la charte
(PageHeader, SectionHeader, Card, Button variant link) ; la carte « Qui es-tu à table ? » est en
haut de `/foyer`.

Choix faits en construisant B *(choix)* :
- Interrupteurs (droit d'inviter d'un compte, d'une invitation) enregistrés au toucher, revenus en
  place en cas d'erreur ; confirmations en deux touches, comme « Supprimer la recette ».
- Les invitations en attente sont dans une carte en retrait sous les personnes (à 375 px, une
  ligne avec avatar et « Annuler » coupait le texte en deux).
- Sans partage natif : copie du message entier (phrase + lien), toast « Lien copié ».
- `/bienvenue` ne renvoie vers l'invitation que si le compte n'a pas de foyer ; sur l'écran
  « Rejoindre le foyer », « Non merci, créer mon propre foyer » oublie l'invitation (sinon
  `/bienvenue` y ramènerait pendant 7 jours).
- Lien qui ne marche plus ou déjà membre : le cookie est effacé par une Server Action appelée au
  chargement (un composant serveur ne peut pas écrire de cookie).
- Guillemets du nom du foyer avec espaces insécables sur `/rejoindre`.

## C : en direct, CLAUDE.md, e2e (rappel des choix)

Le prompt fait foi ; s'y ajoutent *(choix)* : `e2e/realtime-rls.spec.ts` (deux comptes de foyers
différents abonnés au même `list_id` ; on attend l'événement chez le propriétaire, puis 2 s chez
l'intrus) ; dans `e2e/foyer-partage.spec.ts`, « Olivier » est un compte neuf avec son foyer
« Famille F » (dans le seed, Marie-Laure est déjà le « C'est moi » de `marie-laure@popote.test`) ;
si `invite@popote.test` a gardé un foyer d'un passage raté, l'e2e le lui fait quitter d'abord.

## Laissé à l'implémentation

Noms internes, ordre des migrations de test, découpage des composants de B, texte exact des toasts
non cités par le prompt.
