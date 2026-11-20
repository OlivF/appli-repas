-- Liste de courses (migration 0010) : une liste par semaine, partagée par les comptes du foyer ;
-- la mise à jour remplace les articles calculés et garde ceux ajoutés à la main.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

create schema tests;
grant usage on schema tests to authenticated;

create function tests.login_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
end;
$$;

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
grant execute on all functions in schema tests to authenticated;

create table tests.ids (name text primary key, id uuid not null);
grant all on tests.ids to authenticated;

-- Jeu de données, créé en superutilisateur (la RLS ne s'applique pas).
-- Carole est le second compte du foyer d'Alice (comme Marie-Laure chez Olivier).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@example.com'),
  ('b0000000-0000-4000-8000-000000000002', 'bob@example.com'),
  ('c0000000-0000-4000-8000-000000000003', 'carole@example.com');

insert into public.households (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'Foyer Alice'),
  ('b1000000-0000-4000-8000-000000000002', 'Foyer Bob');

insert into public.household_users (household_id, user_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');

insert into public.week_plans (id, household_id, week_start) values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-11-23'),
  ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '2026-11-23');

-- ── Alice : créer, compléter, mettre à jour ─────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

insert into tests.ids
select 'liste', public.sync_shopping_list(
  'a4000000-0000-4000-8000-000000000001', 'menu-1', '',
  $$[
    {"ingredient_id": "1d9e0000-0000-4000-8000-000000000041", "label": "Beurre", "aisle": "cremerie",
     "amounts": [{"quantity": 250, "unit": "g"}], "sources": [], "pantry": false, "checked": true,
     "removed": false, "needed": false, "quantity_changed": false, "position": 0},
    {"ingredient_id": "1d9e0000-0000-4000-8000-000000000100", "label": "Sel", "aisle": "epicerie",
     "amounts": [], "sources": [], "pantry": true, "position": 1}
  ]$$::jsonb);

select results_eq(
  $$select household_id, menu_signature from public.shopping_lists
    where week_plan_id = 'a4000000-0000-4000-8000-000000000001'$$,
  $$values ('a1000000-0000-4000-8000-000000000001'::uuid, 'menu-1')$$,
  'La liste est créée dans le foyer de la semaine, avec la signature du menu');

select results_eq(
  $$select label, checked, pantry, amounts from public.shopping_items order by position$$,
  $$values ('Beurre', true, false, '[{"quantity": 250, "unit": "g"}]'::jsonb), ('Sel', false, true, '[]'::jsonb)$$,
  'Les articles calculés sont enregistrés tels quels');

insert into tests.ids
select 'oeufs', public.add_shopping_item((select id from tests.ids where name = 'liste'), '  oeufs ', '6');

select results_eq(
  $$select label, aisle::text, ingredient_id, manual, quantity_text from public.shopping_items
    where id = (select id from tests.ids where name = 'oeufs')$$,
  $$values ('Œufs', 'cremerie', '1d9e0000-0000-4000-8000-000000000052'::uuid, true, '6')$$,
  'Un article du référentiel prend son nom et son rayon');

insert into tests.ids
select 'bougies', public.add_shopping_item((select id from tests.ids where name = 'liste'), 'Bougies', null);

select results_eq(
  $$select label, aisle::text, ingredient_id, quantity_text from public.shopping_items
    where id = (select id from tests.ids where name = 'bougies')$$,
  $$values ('Bougies', 'autre', null::uuid, null::text)$$,
  'Un article inconnu va au rayon « Autre »');

select throws_ok(
  $$select public.add_shopping_item((select id from tests.ids where name = 'liste'), '   ', null)$$,
  '23514', null,
  'Un article sans nom est refusé');

select is(
  public.sync_shopping_list(
    'a4000000-0000-4000-8000-000000000001', 'menu-2', '',
    $$[{"ingredient_id": "1d9e0000-0000-4000-8000-000000000049", "label": "Lait", "aisle": "cremerie",
        "amounts": [{"quantity": 1800, "unit": "ml"}], "sources": [], "position": 0}]$$::jsonb),
  (select id from tests.ids where name = 'liste'),
  'La mise à jour garde la même liste');

select results_eq(
  $$select label, manual from public.shopping_items order by manual, label$$,
  $$values ('Lait', false), ('Bougies', true), ('Œufs', true)$$,
  'La mise à jour remplace les articles calculés et garde ceux ajoutés à la main');

select is(
  (select menu_signature from public.shopping_lists where id = (select id from tests.ids where name = 'liste')),
  'menu-2',
  'La signature du menu suit la mise à jour');

select public.sync_shopping_list('a4000000-0000-4000-8000-000000000001', 'menu-vide', '', '[]');

select results_eq(
  $$select label from public.shopping_items order by label$$,
  $$values ('Bougies'), ('Œufs')$$,
  'Un menu vidé ne laisse que les articles ajoutés à la main');

-- ── Carole, second compte du foyer : la même liste ──────────────────────────
select tests.login_as('c0000000-0000-4000-8000-000000000003');

select is(
  tests.visible_rows('select id from public.shopping_items'),
  2::bigint,
  'Carole voit la liste du foyer');

select is(
  tests.rows_affected($$update public.shopping_items set checked = true
    where id = (select id from tests.ids where name = 'bougies')$$),
  1::bigint,
  'Carole coche un article');

select tests.login_as('a0000000-0000-4000-8000-000000000001');

select is(
  (select checked from public.shopping_items where id = (select id from tests.ids where name = 'bougies')),
  true,
  'Alice voit la case cochée par Carole');

-- ── Bob : rien de ce qui est à Alice ────────────────────────────────────────
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select is(
  tests.visible_rows('select id from public.shopping_lists')
    + tests.visible_rows('select id from public.shopping_items'),
  0::bigint,
  'Bob ne voit ni la liste ni les articles d''Alice');

select is(
  tests.rows_affected($$update public.shopping_items set checked = false$$),
  0::bigint,
  'Bob ne peut pas décocher les articles d''Alice');

select throws_ok(
  $$select public.sync_shopping_list('a4000000-0000-4000-8000-000000000001', 'piratée', '', '[]')$$,
  '23503', null,
  'Bob ne peut pas créer de liste sur la semaine d''Alice');

select throws_ok(
  $$select public.add_shopping_item((select id from tests.ids where name = 'liste'), 'Pirate', null)$$,
  'P0002', null,
  'Bob ne peut pas ajouter d''article à la liste d''Alice');

-- ── Une semaine supprimée emporte sa liste ──────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');
delete from public.week_plans where id = 'a4000000-0000-4000-8000-000000000001';

select is(
  tests.visible_rows('select id from public.shopping_items'),
  0::bigint,
  'Supprimer la semaine supprime sa liste');

select * from finish();
rollback;
