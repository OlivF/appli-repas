-- Règle de CLAUDE.md : un compte ne voit et ne modifie que les foyers dont il est membre.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

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

-- Nombre de lignes réellement touchées par une écriture (la RLS filtre sans erreur).
create function tests.rows_affected(query text) returns bigint
language plpgsql as $$
declare
  n bigint;
begin
  execute query;
  get diagnostics n = row_count;
  return n;
end;
$$;
-- Nombre de lignes lisibles (0 aussi quand l'accès est refusé).
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
grant execute on all functions in schema tests to authenticated, anon;

-- Jeu de données, créé en superutilisateur (la RLS ne s'applique pas)
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@example.com'),
  ('b0000000-0000-4000-8000-000000000002', 'bob@example.com'),
  ('c0000000-0000-4000-8000-000000000003', 'chloe@example.com');

insert into public.households (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'Foyer Alice'),
  ('b1000000-0000-4000-8000-000000000002', 'Foyer Bob');

insert into public.household_users (household_id, user_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');

insert into public.members (id, household_id, first_name, birth_year) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Alice', 1985),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Arthur', 2018),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Bob', 1980);

insert into public.meal_slots (household_id, day, meal_type, member_ids) values
  ('a1000000-0000-4000-8000-000000000001', 0, 'soir',
    array['a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002']::uuid[]),
  ('a1000000-0000-4000-8000-000000000001', 2, 'pique_nique',
    array['a2000000-0000-4000-8000-000000000002']::uuid[]),
  ('b1000000-0000-4000-8000-000000000002', 0, 'soir',
    array['b2000000-0000-4000-8000-000000000001']::uuid[]);

-- ── Alice : lecture limitée à son foyer ──────────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

select results_eq(
  'select name from public.households',
  $$values ('Foyer Alice')$$,
  'Alice ne voit que son foyer');

select results_eq(
  'select first_name from public.members order by first_name',
  $$values ('Alice'), ('Arthur')$$,
  'Alice ne voit que les membres de son foyer');

select is(
  (select count(*) from public.meal_slots), 2::bigint,
  'Alice ne voit que les créneaux de son foyer');

select is(
  (select count(*) from public.household_users), 1::bigint,
  'Alice ne voit que les comptes de son foyer');

-- ── Alice : aucune écriture possible chez Bob ────────────────────────────────
select throws_ok(
  $$insert into public.members (household_id, first_name, birth_year)
    values ('b1000000-0000-4000-8000-000000000002', 'Intrus', 1990)$$,
  '42501', null,
  'Alice ne peut pas ajouter un membre chez Bob');

select is(
  tests.rows_affected($$update public.members set first_name = 'Pirate'
    where id = 'b2000000-0000-4000-8000-000000000001'$$),
  0::bigint,
  'Alice ne peut pas modifier un membre de Bob');

select is(
  tests.rows_affected($$delete from public.meal_slots
    where household_id = 'b1000000-0000-4000-8000-000000000002'$$),
  0::bigint,
  'Alice ne peut pas supprimer les créneaux de Bob');

select is(
  tests.rows_affected($$update public.households set name = 'Piraté'
    where id = 'b1000000-0000-4000-8000-000000000002'$$),
  0::bigint,
  'Alice ne peut pas renommer le foyer de Bob');

select throws_ok(
  $$insert into public.household_users (household_id, user_id)
    values ('b1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'Alice ne peut pas s''ajouter elle-même au foyer de Bob');

select throws_ok(
  $$insert into public.meal_slots (household_id, day, meal_type, member_ids)
    values ('a1000000-0000-4000-8000-000000000001', 1, 'midi',
            array['b2000000-0000-4000-8000-000000000001']::uuid[])$$,
  '23503', null,
  'Un créneau ne peut contenir que des membres du même foyer');

-- ── Alice : écritures dans son propre foyer ─────────────────────────────────
select lives_ok(
  $$insert into public.members (household_id, first_name, birth_year, diets, appetite)
    values ('a1000000-0000-4000-8000-000000000001', 'Anna', 2016, '{keto}', 'grand')$$,
  'Alice peut ajouter un membre chez elle');

select is(
  tests.rows_affected($$update public.households set name = 'Famille Alice'
    where id = 'a1000000-0000-4000-8000-000000000001'$$),
  1::bigint,
  'Alice peut renommer son foyer');

-- Supprimer Arthur le retire des créneaux ; le pique-nique où il était seul disparaît.
delete from public.members where id = 'a2000000-0000-4000-8000-000000000002';

select results_eq(
  'select day, meal_type::text, member_ids from public.meal_slots order by day',
  $$values (0::smallint, 'soir'::text, array['a2000000-0000-4000-8000-000000000001']::uuid[])$$,
  'Un membre supprimé est retiré des créneaux, et un créneau vide est supprimé');

-- ── Bob : règles des créneaux ───────────────────────────────────────────────
reset role;
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select throws_ok(
  $$insert into public.meal_slots (household_id, day, meal_type, member_ids)
    values ('b1000000-0000-4000-8000-000000000002', 7, 'midi',
            array['b2000000-0000-4000-8000-000000000001']::uuid[])$$,
  '23514', null,
  'Les jours vont de 0 (lundi) à 6 (dimanche)');

select throws_ok(
  $$insert into public.meal_slots (household_id, day, meal_type, member_ids)
    values ('b1000000-0000-4000-8000-000000000002', 1, 'midi', '{}')$$,
  '23514', null,
  'Un créneau sans personne est refusé');

-- ── Chloé : création d'un foyer ─────────────────────────────────────────────
reset role;
select tests.login_as('c0000000-0000-4000-8000-000000000003');

select lives_ok(
  $$select public.create_household('Foyer Chloé')$$,
  'Chloé peut créer un foyer');

select results_eq(
  'select name from public.households',
  $$values ('Foyer Chloé')$$,
  'Chloé voit le foyer qu''elle vient de créer, et seulement lui');

select is(
  (select count(*) from public.household_users
    where user_id = 'c0000000-0000-4000-8000-000000000003'),
  1::bigint,
  'Chloé est rattachée à son nouveau foyer');

select lives_ok(
  $$insert into public.members (household_id, first_name, birth_year)
    select id, 'Chloé', 1990 from public.households$$,
  'Chloé peut ajouter un membre à son nouveau foyer');

-- ── Visiteur non connecté ───────────────────────────────────────────────────
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  tests.visible_rows('select id from public.households')
    + tests.visible_rows('select id from public.members')
    + tests.visible_rows('select id from public.meal_slots')
    + tests.visible_rows('select user_id from public.household_users'),
  0::bigint,
  'Un visiteur non connecté ne lit aucune donnée des foyers');

select throws_ok(
  $$select public.create_household('Foyer anonyme')$$,
  '42501', null,
  'Un visiteur non connecté ne peut pas créer de foyer');

select * from finish();
rollback;
