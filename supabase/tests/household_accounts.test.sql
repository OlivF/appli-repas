-- Foyer partagé (migration 0013) : les comptes qui organisent un foyer, les invitations par code,
-- « au moins un admin » et « le foyer disparaît avec son dernier compte ».
-- Comptes : Olivier (crée le foyer, admin), Marie-Laure (invitée), Xavier (un inconnu, qui a son
-- propre foyer), Yann (supprime son compte Supabase).
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(76);

-- Outils de test (annulés avec la transaction)
create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.login_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

create function tests.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end;
$$;

create function tests.visible_rows(query text) returns bigint
language plpgsql as $$
declare
  n bigint;
begin
  execute format('select count(*) from (%s) q', query) into n;
  return n;
exception when insufficient_privilege then
  return 0;
end;
$$;

create table tests.ids (name text primary key, id uuid not null);
create table tests.codes (name text primary key, code text not null);
grant all on tests.ids, tests.codes to authenticated, anon;

create function tests.id(key text) returns uuid
language sql stable as $$ select id from tests.ids where name = key $$;
create function tests.code(key text) returns text
language sql stable as $$ select code from tests.codes where name = key $$;
-- Lu en superutilisateur : l'id d'une invitation d'après son code.
create function tests.invite_id(key text) returns uuid
language sql stable security definer as $$
  select id from public.household_invites where code = tests.code(key)
$$;
create function tests.preview_status(key text) returns text
language sql as $$ select status from public.household_invite_preview(tests.code(key)) $$;
grant execute on all functions in schema tests to authenticated, anon;

-- Jeu de données, créé en superutilisateur (la RLS ne s'applique pas)
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'olivier@example.com'),
  ('b0000000-0000-4000-8000-000000000002', 'marie-laure@example.com'),
  ('c0000000-0000-4000-8000-000000000003', 'xavier@example.com'),
  ('d0000000-0000-4000-8000-000000000004', 'yann@example.com');

-- ── Olivier crée son foyer ───────────────────────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

insert into tests.ids select 'foyer', public.create_household('Famille F');

select is(
  (select role::text from public.household_users),
  'admin',
  'Le compte qui crée le foyer peut inviter');

select throws_ok(
  $$select public.create_household('Second foyer')$$,
  'HA001', 'Tu fais déjà partie d''un foyer',
  'Un compte qui a déjà un foyer n''en crée pas un second');

-- Le contenu du foyer, ajouté en superutilisateur.
reset role;
insert into public.members (id, household_id, first_name, birth_year) values
  ('a2000000-0000-4000-8000-000000000001', tests.id('foyer'), 'Olivier', 1986),
  ('a2000000-0000-4000-8000-000000000002', tests.id('foyer'), 'Marie-Laure', 1986),
  ('a2000000-0000-4000-8000-000000000003', tests.id('foyer'), 'Otis', 2020);
insert into public.recipes (id, household_id, title, meal_types, servings) values
  ('a3000000-0000-4000-8000-000000000001', tests.id('foyer'), 'Lasagnes', '{soir}', 4);
insert into public.ingredients (id, household_id, name, aisle, shopping_unit) values
  ('a3100000-0000-4000-8000-000000000001', tests.id('foyer'), 'Confit maison', 'boucherie', 'g');
insert into public.week_plans (id, household_id, week_start) values
  ('a4000000-0000-4000-8000-000000000001', tests.id('foyer'), '2026-11-23');
insert into public.planned_meals (week_plan_id, day, meal_type, recipe_id, member_ids) values
  ('a4000000-0000-4000-8000-000000000001', 0, 'soir', 'a3000000-0000-4000-8000-000000000001',
   array['a2000000-0000-4000-8000-000000000001']::uuid[]);
insert into public.shopping_lists (id, week_plan_id) values
  ('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001');
insert into public.shopping_items (list_id, ingredient_id, label) values
  ('a5000000-0000-4000-8000-000000000001', '1d9e0000-0000-4000-8000-000000000052', 'Œufs');
-- Au frigo : un article réservé à la liste, un reste de plat, un ingrédient propre au foyer.
insert into public.fridge_items (ingredient_id, label, quantity, origin, reserved_list_id) values
  ('1d9e0000-0000-4000-8000-000000000052', 'Œufs', 6, 'shopping', 'a5000000-0000-4000-8000-000000000001');
insert into public.fridge_items (household_id, label, quantity, origin, recipe_id) values
  (tests.id('foyer'), 'Reste : Lasagnes', 2, 'leftover', 'a3000000-0000-4000-8000-000000000001');
insert into public.fridge_items (household_id, ingredient_id, label, quantity) values
  (tests.id('foyer'), 'a3100000-0000-4000-8000-000000000001', 'Confit maison', 300);

-- ── Olivier : « C'est moi » et invitations ──────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

select lives_ok(
  $$select public.set_my_member('a2000000-0000-4000-8000-000000000001')$$,
  'Olivier dit « C''est moi » sur le mangeur Olivier');

insert into tests.codes (name, code)
select 'marie-laure', code from public.create_household_invite(tests.id('foyer'), 'member');

select ok(
  tests.code('marie-laure') ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$',
  'Un code : 8 caractères lisibles au téléphone (sans 0, O, 1, I, L)');

select results_eq(
  $$select role::text, expires_at = now() + interval '7 days', created_by
    from public.household_invites where code = tests.code('marie-laure')$$,
  $$values ('member', true, 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
  'L''invitation garde son rôle, son auteur, et vaut 7 jours');

insert into tests.codes (name, code)
select 'xavier', code from public.create_household_invite(tests.id('foyer'));
insert into tests.codes (name, code)
select 'expiree', code from public.create_household_invite(tests.id('foyer'));
insert into tests.codes (name, code)
select 'annulee', code from public.create_household_invite(tests.id('foyer'));
insert into tests.codes (name, code)
select 'cinquieme', code from public.create_household_invite(tests.id('foyer'));

select is(
  (select role::text from public.household_invites where code = tests.code('xavier')),
  'admin',
  'Sans rôle donné, l''invitation permet d''inviter à son tour');

select throws_ok(
  $$select public.create_household_invite(tests.id('foyer'))$$,
  'HA004', null,
  'Pas plus de 5 invitations en attente par foyer');

select lives_ok(
  $$select public.revoke_household_invite(tests.invite_id('annulee'))$$,
  'Olivier annule une invitation');

select lives_ok(
  $$select public.create_household_invite(tests.id('foyer'))$$,
  'Une invitation annulée libère une place');

select lives_ok(
  $$select public.set_household_invite_role(tests.invite_id('xavier'), 'member')$$,
  'Olivier change le rôle d''une invitation en attente');

select is(
  (select role::text from public.household_invites where code = tests.code('xavier')),
  'member',
  'Le code ne change pas, le rôle si');

select public.set_household_invite_role(tests.invite_id('xavier'), 'admin');

select is(
  (select count(*) from public.household_invites),
  6::bigint,
  'Olivier lit les invitations de son foyer');

select throws_ok(
  $$insert into public.household_invites (household_id, code)
    values (tests.id('foyer'), 'ABCDEFGH')$$,
  '42501', null,
  'Aucune invitation n''est écrite directement');

-- L'invitation « expiree » a dépassé ses 7 jours.
reset role;
update public.household_invites set expires_at = now() - interval '1 minute'
where code = tests.code('expiree');

select throws_ok(
  $$select public.set_household_invite_role(tests.invite_id('expiree'), 'member')$$,
  'HA002', null,
  'Le rôle d''une invitation qui ne marche plus ne change pas');

-- ── Visiteur non connecté : l'aperçu d'une invitation ───────────────────────
select tests.login_anon();

select results_eq(
  $$select * from public.household_invite_preview(tests.code('marie-laure'))$$,
  $$values ('Famille F', 'Olivier', 'valid', false)$$,
  'Un visiteur voit le foyer et le prénom de la personne qui l''invite');

select results_eq(
  $$select status from public.household_invite_preview(
    lower(substr(tests.code('marie-laure'), 1, 4)) || ' – ' || lower(substr(tests.code('marie-laure'), 5)))$$,
  $$values ('valid')$$,
  'Le code est reconnu en minuscules, avec espaces et tiret');

select results_eq(
  $$select * from public.household_invite_preview(tests.code('expiree'))$$,
  $$values (null::text, null::text, 'expired', false)$$,
  'Une invitation expirée ne dit plus rien du foyer');

select is(tests.preview_status('annulee'), 'revoked', 'Une invitation annulée est signalée');

select is(
  (select status from public.household_invite_preview('ZZZZ-ZZZZ')),
  'unknown',
  'Un code inconnu est signalé');

select is(
  (select status from public.household_invite_preview('pas un code')),
  'unknown',
  'Un code mal formé est inconnu');

select is(
  (select pg_get_function_result('public.household_invite_preview(text)'::regprocedure)),
  'TABLE(household_name text, inviter_name text, status text, is_member boolean)',
  'L''aperçu ne rend que le nom du foyer, le prénom de l''invitant, le statut et « déjà membre »');

select ok(
  (select row(p.*)::text !~ '@|[0-9a-f]{8}-[0-9a-f]{4}'
   from public.household_invite_preview(tests.code('marie-laure')) p),
  'L''aperçu ne contient ni email ni identifiant');

select is(
  tests.visible_rows('select id from public.household_invites'),
  0::bigint,
  'Un visiteur ne lit aucune invitation');

select throws_ok(
  $$select public.accept_household_invite(tests.code('marie-laure'))$$,
  '42501', null,
  'Un visiteur ne peut pas accepter une invitation sans compte');

-- ── Xavier, un inconnu avec son propre foyer ────────────────────────────────
select tests.login_as('c0000000-0000-4000-8000-000000000003');

insert into tests.ids select 'chez-xavier', public.create_household('Chez Xavier');
reset role;
insert into public.members (id, household_id, first_name, birth_year) values
  ('c2000000-0000-4000-8000-000000000001', tests.id('chez-xavier'), 'Xavier', 1990);
insert into public.recipes (household_id, title, meal_types, servings) values
  (tests.id('chez-xavier'), 'Gratin', '{soir}', 2);
select tests.login_as('c0000000-0000-4000-8000-000000000003');

select is(
  (select count(*) from public.household_invites),
  0::bigint,
  'Un inconnu ne lit pas les invitations d''un autre foyer');

select throws_ok(
  $$select public.create_household_invite(tests.id('foyer'))$$,
  '42501', null,
  'Un inconnu ne crée pas d''invitation pour un autre foyer');

select throws_ok(
  $$select public.revoke_household_invite(tests.invite_id('xavier'))$$,
  'P0002', null,
  'Un inconnu n''annule pas l''invitation d''un autre foyer');

select results_eq(
  'select email, role::text, is_me from public.household_accounts()',
  $$values ('xavier@example.com', 'admin', true)$$,
  'household_accounts() ne rend que les comptes de son foyer');

select is(
  (select is_member from public.household_invite_preview(tests.code('xavier'))),
  false,
  'L''aperçu dit à Xavier qu''il n''est pas dans ce foyer');

-- ── Marie-Laure accepte l'invitation ────────────────────────────────────────
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select is(
  tests.visible_rows('select id from public.recipes where household_id is not null'),
  0::bigint,
  'Avant d''accepter, Marie-Laure ne voit rien du foyer');

select is(
  public.accept_household_invite(
    lower(substr(tests.code('marie-laure'), 1, 4)) || '-' || lower(substr(tests.code('marie-laure'), 5))),
  tests.id('foyer'),
  'Marie-Laure rejoint le foyer avec le code tapé à la main');

select is(
  (select count(*) from public.recipes where household_id = tests.id('foyer'))
    + (select count(*) from public.week_plans)
    + (select count(*) from public.planned_meals)
    + (select count(*) from public.shopping_items)
    + (select count(*) from public.fridge_items),
  7::bigint,
  'Marie-Laure voit les recettes, la semaine, la liste de courses et le frigo du foyer');

select results_eq(
  $$select role::text, member_id, member_chosen_at from public.household_users
    where user_id = 'b0000000-0000-4000-8000-000000000002'$$,
  $$values ('member', null::uuid, null::timestamptz)$$,
  'Elle a le rôle de l''invitation, et n''a pas encore dit qui elle est à table');

reset role;
select results_eq(
  $$select used_by, used_at is not null from public.household_invites
    where code = tests.code('marie-laure')$$,
  $$values ('b0000000-0000-4000-8000-000000000002'::uuid, true)$$,
  'L''invitation est marquée utilisée');
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select is(tests.preview_status('marie-laure'), 'used', 'Une invitation utilisée est signalée');

select throws_ok(
  $$select public.accept_household_invite(tests.code('marie-laure'))$$,
  'HA002', null,
  'Un code ne sert qu''une fois');

select is(
  public.accept_household_invite(tests.code('xavier')),
  tests.id('foyer'),
  'Déjà dans ce foyer : accepter ne fait rien et rend le foyer');

select is(tests.preview_status('xavier'), 'valid', 'L''invitation n''est pas consommée pour rien');

select is(
  (select is_member from public.household_invite_preview(tests.code('xavier'))),
  true,
  'L''aperçu dit à Marie-Laure qu''elle est déjà dans ce foyer');

select is(
  (select count(*) from public.household_invites),
  0::bigint,
  'Une personne qui ne peut pas inviter ne lit pas les invitations');

select throws_ok(
  $$select public.create_household_invite(tests.id('foyer'))$$,
  '42501', null,
  'Une personne qui ne peut pas inviter ne crée pas d''invitation');

select throws_ok(
  $$select public.set_household_role('a0000000-0000-4000-8000-000000000001', 'member')$$,
  '42501', null,
  'Elle ne change pas le rôle d''un autre compte');

select throws_ok(
  $$select public.remove_household_account('a0000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'Elle ne retire personne du foyer');

select throws_ok(
  $$insert into public.household_users (household_id, user_id, role)
    values (tests.id('chez-xavier'), 'b0000000-0000-4000-8000-000000000002', 'admin')$$,
  '42501', null,
  'Personne ne s''ajoute directement à un foyer');

select throws_ok(
  $$update public.household_users set role = 'admin'
    where user_id = 'b0000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'Personne ne se donne directement le droit d''inviter');

-- « C'est moi »
select throws_ok(
  $$select public.set_my_member('a2000000-0000-4000-8000-000000000001')$$,
  '23505', null,
  'Un mangeur n''est le « C''est moi » que d''un seul compte');

select throws_ok(
  $$select public.set_my_member('c2000000-0000-4000-8000-000000000001')$$,
  'P0002', null,
  'Un compte ne dit « C''est moi » que sur un mangeur de son foyer');

select lives_ok(
  $$select public.set_my_member(null)$$,
  '« Je ne mange pas ici »');

select results_eq(
  $$select member_id, member_chosen_at is not null from public.household_users
    where user_id = 'b0000000-0000-4000-8000-000000000002'$$,
  $$values (null::uuid, true)$$,
  '« Je ne mange pas ici » est retenu');

select public.set_my_member('a2000000-0000-4000-8000-000000000002');

select results_eq(
  'select email, role::text, member_id, is_me from public.household_accounts()',
  $$values
    ('olivier@example.com', 'admin', 'a2000000-0000-4000-8000-000000000001'::uuid, false),
    ('marie-laure@example.com', 'member', 'a2000000-0000-4000-8000-000000000002'::uuid, true)$$,
  'household_accounts() : les comptes du foyer, par ordre d''arrivée');

-- ── Xavier rejoint le foyer en quittant le sien ─────────────────────────────
select tests.login_as('c0000000-0000-4000-8000-000000000003');

select throws_ok(
  $$select public.accept_household_invite(tests.code('xavier'))$$,
  'HA001', null,
  'Avec un autre foyer, accepter échoue sans leave_current');

select is(
  public.accept_household_invite(tests.code('xavier'), leave_current => true),
  tests.id('foyer'),
  'Avec leave_current, Xavier quitte son foyer et rejoint celui d''Olivier');

reset role;
select is(
  (select count(*) from public.households where id = tests.id('chez-xavier'))
    + (select count(*) from public.members where household_id = tests.id('chez-xavier'))
    + (select count(*) from public.recipes where household_id = tests.id('chez-xavier')),
  0::bigint,
  'Son ancien foyer, dont il était le seul compte, est supprimé avec son contenu');

-- Xavier peut inviter : il crée un lien, puis Olivier le retire du foyer.
select tests.login_as('c0000000-0000-4000-8000-000000000003');
insert into tests.codes (name, code)
select 'de-xavier', code from public.create_household_invite(tests.id('foyer'), 'member');

select tests.login_as('a0000000-0000-4000-8000-000000000001');

select throws_ok(
  $$select public.remove_household_account('a0000000-0000-4000-8000-000000000001')$$,
  'HA005', null,
  'On ne se retire pas soi-même : on quitte le foyer');

select lives_ok(
  $$select public.remove_household_account('c0000000-0000-4000-8000-000000000003')$$,
  'Olivier retire Xavier du foyer');

select is(tests.preview_status('de-xavier'), 'revoked', 'Les invitations de Xavier sont annulées');

select tests.login_as('c0000000-0000-4000-8000-000000000003');

select is(
  tests.visible_rows('select id from public.households')
    + tests.visible_rows('select id from public.recipes where household_id is not null')
    + tests.visible_rows('select id from public.week_plans')
    + tests.visible_rows('select id from public.shopping_items')
    + tests.visible_rows('select id from public.fridge_items')
    + tests.visible_rows('select user_id from public.household_accounts()'),
  0::bigint,
  'Un compte retiré ne voit plus rien du foyer');

select throws_ok(
  $$select public.accept_household_invite(tests.code('de-xavier'))$$,
  'HA002', null,
  'Il ne revient pas par un lien qu''il avait créé');

-- ── Droit d'inviter ─────────────────────────────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

select throws_ok(
  $$select public.set_household_role('a0000000-0000-4000-8000-000000000001', 'member')$$,
  'HA003', null,
  'Le dernier compte qui peut inviter garde ce droit');

select lives_ok(
  $$select public.set_household_role('b0000000-0000-4000-8000-000000000002', 'admin')$$,
  'Olivier donne à Marie-Laure le droit d''inviter');

select tests.login_as('b0000000-0000-4000-8000-000000000002');
insert into tests.codes (name, code)
select 'de-marie-laure', code from public.create_household_invite(tests.id('foyer'));

select is(
  (select count(*) from public.household_invites),
  8::bigint,
  'Marie-Laure lit maintenant les invitations du foyer');

select tests.login_as('a0000000-0000-4000-8000-000000000001');

select lives_ok(
  $$select public.set_household_role('b0000000-0000-4000-8000-000000000002', 'member')$$,
  'Olivier lui retire ce droit');

select is(
  tests.preview_status('de-marie-laure'),
  'revoked',
  'Les invitations d''un compte qui ne peut plus inviter sont annulées');

-- Xavier revient avec une nouvelle invitation, sans droit d'inviter.
insert into tests.codes (name, code)
select 'retour-xavier', code from public.create_household_invite(tests.id('foyer'), 'member');
select tests.login_as('c0000000-0000-4000-8000-000000000003');
select public.accept_household_invite(tests.code('retour-xavier'));
select public.set_my_member('a2000000-0000-4000-8000-000000000003');

-- Un mangeur supprimé n'est plus le « C'est moi » de personne ; la réponse reste donnée.
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select lives_ok(
  $$delete from public.members where id = 'a2000000-0000-4000-8000-000000000003'$$,
  'On supprime un mangeur qui est le « C''est moi » d''un compte');

select results_eq(
  $$select member_id, member_chosen_at is not null from public.household_users
    where user_id = 'c0000000-0000-4000-8000-000000000003'$$,
  $$values (null::uuid, true)$$,
  'Le compte n''a plus de « C''est moi », sans que la carte « Qui es-tu à table ? » revienne');

-- Ordre d'arrivée : Olivier, Xavier, puis Marie-Laure (inverse de l'ordre des identifiants).
reset role;
update public.household_users set created_at = now() - interval '3 hours'
where user_id = 'a0000000-0000-4000-8000-000000000001';
update public.household_users set created_at = now() - interval '2 hours'
where user_id = 'c0000000-0000-4000-8000-000000000003';
update public.household_users set created_at = now() - interval '1 hour'
where user_id = 'b0000000-0000-4000-8000-000000000002';

-- ── Départs ─────────────────────────────────────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

select lives_ok($$select public.leave_household()$$, 'Olivier, seul à pouvoir inviter, quitte le foyer');

reset role;
select results_eq(
  $$select user_id, role::text from public.household_users
    where household_id = tests.id('foyer') order by created_at$$,
  $$values
    ('c0000000-0000-4000-8000-000000000003'::uuid, 'admin'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, 'member')$$,
  'Le compte arrivé le premier après lui peut désormais inviter');

select is(
  (select count(*) from public.household_invites where household_id = tests.id('foyer')
     and created_by = 'a0000000-0000-4000-8000-000000000001'
     and used_at is null and revoked_at is null and expires_at > now()),
  0::bigint,
  'Les invitations en attente d''Olivier sont annulées à son départ');

select tests.login_as('a0000000-0000-4000-8000-000000000001');

select throws_ok(
  $$select public.leave_household()$$,
  'P0002', null,
  'Sans foyer, il n''y a rien à quitter');

select lives_ok(
  $$select public.create_household('Nouveau départ')$$,
  'Un compte qui a quitté son foyer peut en créer un autre');

select tests.login_as('c0000000-0000-4000-8000-000000000003');
select public.leave_household();

select tests.login_as('b0000000-0000-4000-8000-000000000002');

select is(
  (select role::text from public.household_users),
  'admin',
  'Seule restante, Marie-Laure peut inviter');

select lives_ok($$select public.leave_household()$$, 'Le dernier compte quitte le foyer');

reset role;
select is(
  (select count(*) from public.households where id = tests.id('foyer'))
    + (select count(*) from public.members where household_id = tests.id('foyer'))
    + (select count(*) from public.recipes where household_id = tests.id('foyer'))
    + (select count(*) from public.ingredients where household_id = tests.id('foyer'))
    + (select count(*) from public.week_plans where household_id = tests.id('foyer'))
    + (select count(*) from public.planned_meals where household_id = tests.id('foyer'))
    + (select count(*) from public.shopping_lists where household_id = tests.id('foyer'))
    + (select count(*) from public.shopping_items where household_id = tests.id('foyer'))
    + (select count(*) from public.fridge_items where household_id = tests.id('foyer'))
    + (select count(*) from public.household_invites where household_id = tests.id('foyer')),
  0::bigint,
  'Le foyer disparaît avec son dernier compte, et tout ce qu''il contient');

-- ── Suppression d'un compte Supabase ────────────────────────────────────────
select tests.login_as('d0000000-0000-4000-8000-000000000004');
insert into tests.ids select 'chez-yann', public.create_household('Chez Yann');
reset role;

delete from auth.users where id = 'd0000000-0000-4000-8000-000000000004';

select is(
  (select count(*) from public.households where id = tests.id('chez-yann')),
  0::bigint,
  'Un compte Supabase supprimé emporte le foyer dont il était le seul compte');

-- ── Visiteur : fonctions réservées aux comptes ──────────────────────────────
select tests.login_anon();

select throws_ok(
  $$select * from public.household_accounts()$$,
  '42501', null,
  'Un visiteur ne liste aucun compte');

select throws_ok(
  $$select public.create_household_invite(gen_random_uuid())$$,
  '42501', null,
  'Un visiteur ne crée pas d''invitation');

select * from finish();
rollback;
