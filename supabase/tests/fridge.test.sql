-- Frigo (migration 0011) : articles libres ou réservés à la liste d'une semaine, foyer et unité
-- contrôlés par trigger, bilan de fin de semaine appliqué une seule fois.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

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

create function tests.id(key text) returns uuid
language sql stable as $$ select id from tests.ids where name = key $$;
grant execute on function tests.id(text) to authenticated;

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
  ('a4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '2026-11-30');

insert into public.recipes (id, household_id, title, meal_types, servings) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Lasagnes', '{soir}', 4);

insert into public.ingredients (id, household_id, name, aisle, shopping_unit) values
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Confit maison', 'boucherie', 'g');

-- ── Alice : la liste de la semaine, et le frigo ─────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

insert into tests.ids
select 'liste', public.sync_shopping_list(
  'a4000000-0000-4000-8000-000000000001', 'menu-1', 'frigo-1',
  $$[
    {"ingredient_id": "1d9e0000-0000-4000-8000-000000000043", "label": "Crème fraîche épaisse",
     "aisle": "cremerie", "amounts": [{"quantity": 150, "unit": "g"}], "sources": [], "pantry": false,
     "checked": true, "removed": false, "needed": false, "quantity_changed": false, "position": 0,
     "from_fridge": 200, "maybe_in_fridge": true, "stored": true},
    {"ingredient_id": "1d9e0000-0000-4000-8000-000000000041", "label": "Beurre", "aisle": "cremerie",
     "amounts": [{"quantity": 250, "unit": "g"}], "sources": [], "position": 1}
  ]$$::jsonb);

select results_eq(
  $$select label, from_fridge, maybe_in_fridge, stored from public.shopping_items order by position$$,
  $$values ('Crème fraîche épaisse', 200::numeric, true, true), ('Beurre', 0::numeric, false, false)$$,
  'La liste enregistre la part prise au frigo, « peut-être au frigo » et « déjà rangé »');

select is(
  (select fridge_signature from public.shopping_lists where id = tests.id('liste')),
  'frigo-1',
  'La liste enregistre la signature du frigo');

-- Rangés depuis les courses : réservés à la liste, sans foyer ni unité donnés.
insert into public.fridge_items (id, ingredient_id, label, quantity, origin, reserved_list_id) values
  ('af000000-0000-4000-8000-000000000001', '1d9e0000-0000-4000-8000-000000000052', 'Œufs', 6, 'shopping', tests.id('liste')),
  ('af000000-0000-4000-8000-000000000002', '1d9e0000-0000-4000-8000-000000000049', 'Lait', 1000, 'shopping', tests.id('liste'));

select results_eq(
  $$select household_id, unit::text from public.fridge_items where id = 'af000000-0000-4000-8000-000000000001'$$,
  $$values ('a1000000-0000-4000-8000-000000000001'::uuid, 'piece')$$,
  'Un article rangé prend le foyer de sa liste et l''unité d''achat de son ingrédient');

-- Un reste libre : la crème, et un reste de plat sans ingrédient.
insert into public.fridge_items (id, household_id, ingredient_id, label, quantity, unit, best_before) values
  ('af000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001',
   '1d9e0000-0000-4000-8000-000000000043', 'Crème fraîche épaisse', 200, 'g', '2026-11-20');

insert into public.fridge_items (id, household_id, label, quantity, origin, recipe_id, best_before) values
  ('af000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001',
   'Reste : Lasagnes', 2, 'leftover', 'a2000000-0000-4000-8000-000000000001', '2026-11-22');

select results_eq(
  $$select origin::text, quantity, unit::text, reserved_list_id from public.fridge_items
    where id = 'af000000-0000-4000-8000-000000000004'$$,
  $$values ('leftover', 2::numeric, null::text, null::uuid)$$,
  'Un reste de plat compte des parts, sans unité, libre');

select throws_ok(
  $$insert into public.fridge_items (household_id, ingredient_id, label, quantity, unit)
    values ('a1000000-0000-4000-8000-000000000001', '1d9e0000-0000-4000-8000-000000000043', 'Crème', 20, 'ml')$$,
  '23514', null,
  'Avec un ingrédient, l''unité est forcément son unité d''achat');

select throws_ok(
  $$update public.fridge_items set unit = 'g' where id = 'af000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'L''unité d''un article ne peut pas quitter celle de son ingrédient');

select throws_ok(
  $$insert into public.fridge_items (household_id, label, quantity) values ('a1000000-0000-4000-8000-000000000001', 'Rien', 0)$$,
  '23514', null,
  'Une quantité est positive');

select throws_ok(
  $$insert into public.fridge_items (household_id, ingredient_id, label)
    values ('a1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'Confit')$$,
  '23503', null,
  'Alice ne peut pas ranger un ingrédient du foyer de Bob');

-- ── Carole, second compte du foyer : le même frigo ──────────────────────────
select tests.login_as('c0000000-0000-4000-8000-000000000003');

select is(
  tests.visible_rows('select id from public.fridge_items'),
  4::bigint,
  'Carole voit le frigo du foyer');

-- ── Bob : rien de ce qui est à Alice ────────────────────────────────────────
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select is(
  tests.visible_rows('select id from public.fridge_items'),
  0::bigint,
  'Bob ne voit pas le frigo d''Alice');

select is(
  tests.rows_affected($$update public.fridge_items set quantity = 1$$),
  0::bigint,
  'Bob ne peut pas modifier le frigo d''Alice');

select throws_ok(
  format($$insert into public.fridge_items (household_id, label, reserved_list_id)
    values ('b1000000-0000-4000-8000-000000000002', 'Pirate', %L)$$, tests.id('liste')),
  '23503', null,
  'Bob ne peut pas réserver un article à la liste d''Alice');

select throws_ok(
  format($$select public.apply_fridge_settlement(%L, '[]')$$, tests.id('liste')),
  'P0002', null,
  'Bob ne peut pas solder la liste d''Alice');

-- ── Bilan de la semaine ─────────────────────────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

select is(
  public.apply_fridge_settlement(tests.id('liste'),
    '[{"id": "af000000-0000-4000-8000-000000000001", "quantity": 2},
      {"id": "af000000-0000-4000-8000-000000000002", "quantity": null}]'),
  true,
  'Le bilan s''applique');

select results_eq(
  $$select label, quantity, reserved_list_id from public.fridge_items order by id$$,
  $$values ('Œufs', 2::numeric, null::uuid), ('Crème fraîche épaisse', 200, null), ('Reste : Lasagnes', 2, null)$$,
  'Le bilan réduit les œufs, supprime le lait, libère ce qui restait réservé et laisse les restes');

select isnt(
  (select settled_at from public.shopping_lists where id = tests.id('liste')),
  null,
  'La liste est soldée');

select is(
  public.apply_fridge_settlement(tests.id('liste'),
    '[{"id": "af000000-0000-4000-8000-000000000001", "quantity": null},
      {"id": "af000000-0000-4000-8000-000000000003", "quantity": 50}]'),
  false,
  'Un deuxième bilan (l''autre téléphone) ne fait rien');

select results_eq(
  $$select label, quantity from public.fridge_items order by id$$,
  $$values ('Œufs', 2::numeric), ('Crème fraîche épaisse', 200), ('Reste : Lasagnes', 2)$$,
  'Le frigo n''a pas bougé au deuxième bilan');

-- ── Une liste supprimée libère ses articles ─────────────────────────────────
insert into tests.ids
select 'liste-2', public.sync_shopping_list('a4000000-0000-4000-8000-000000000002', 'menu-2', '', '[]');

insert into public.fridge_items (id, ingredient_id, label, quantity, origin, reserved_list_id) values
  ('af000000-0000-4000-8000-000000000005', '1d9e0000-0000-4000-8000-000000000041', 'Beurre', 250, 'shopping', tests.id('liste-2'));

delete from public.week_plans where id = 'a4000000-0000-4000-8000-000000000002';

select results_eq(
  $$select reserved_list_id, household_id from public.fridge_items where id = 'af000000-0000-4000-8000-000000000005'$$,
  $$values (null::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid)$$,
  'Supprimer la semaine rend libre ce qui lui était réservé');

-- ── Plats et référentiel ────────────────────────────────────────────────────
select col_default_is('public', 'planned_meals', 'skipped', 'false', 'Un plat est cuisiné par défaut');

select results_eq(
  $$select name, shelf_life_days from public.ingredients
    where household_id is null
      and name in ('Bœuf haché', 'Steaks hachés pur bœuf', 'Frites surgelées au four', 'Riz', 'Sel')
    order by name$$,
  $$values ('Bœuf haché', 1), ('Frites surgelées au four', 90), ('Riz', null::integer), ('Sel', null),
           ('Steaks hachés pur bœuf', 1)$$,
  'Durées de conservation : viande hachée 1 jour, surgelés 90, rien pour l''épicerie');

select * from finish();
rollback;
