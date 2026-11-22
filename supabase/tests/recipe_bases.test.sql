-- Élément principal (base) et recettes basiques (migration 0006) : enregistrés par
-- save_recipe, recopiés par copy_recipe, remplis pour les recettes évidentes du catalogue.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

create schema tests;
grant usage on schema tests to authenticated;
create table tests.ids (name text primary key, id uuid not null);
grant all on tests.ids to authenticated;

-- Jeu de données, créé en superutilisateur (la RLS ne s'applique pas)
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@example.com');
insert into public.households (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'Foyer Alice');
insert into public.household_users (household_id, user_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001');
insert into public.recipes (id, household_id, title, meal_types, servings, base, basic) values
  ('cc000000-0000-4000-8000-000000000001', null, 'Côte de porc et frites', '{soir}', 4, 'Côte de porc', true);

-- ── Le catalogue de 0003 ────────────────────────────────────────────────────
select results_eq(
  $$select right(id::text, 2), base from public.recipes
    where id::text like 'ca7a0000-0000-4000-8000-%' and base is not null order by id$$,
  $$values ('15', 'Poulet'), ('16', 'Quiche lorraine'), ('21', 'Poulet'), ('22', 'Saumon')$$,
  'Seules les recettes évidentes du catalogue 0003 ont une base (la quiche depuis 0017)');

select is(
  (select count(*) from public.recipes where id::text like 'ca7a0000-0000-4000-8000-%' and basic),
  0::bigint,
  'Aucune recette du catalogue 0003 n''est basique');

-- ── Alice enregistre ────────────────────────────────────────────────────────
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims',
  '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}', true);

insert into tests.ids
select 'steak', public.save_recipe(
  'a1000000-0000-4000-8000-000000000001',
  '{"title": "Steak haché et frites", "meal_types": ["soir"], "servings": 4,
    "base": "  Steak haché ", "basic": true}',
  '[]', '{}');

select results_eq(
  $$select base, basic from public.recipes where id = (select id from tests.ids where name = 'steak')$$,
  $$values ('Steak haché', true)$$,
  'save_recipe enregistre la base, sans espaces autour, et le drapeau basique');

insert into tests.ids
select 'gratin', public.save_recipe(
  'a1000000-0000-4000-8000-000000000001',
  '{"title": "Gratin", "meal_types": ["soir"], "servings": 4, "base": "   "}',
  '[]', '{}');

select results_eq(
  $$select base, basic from public.recipes where id = (select id from tests.ids where name = 'gratin')$$,
  $$values (null::text, false)$$,
  'Une base vide devient nulle ; une recette n''est pas basique par défaut');

select public.save_recipe(
  'a1000000-0000-4000-8000-000000000001',
  '{"title": "Steak haché et haricots verts", "meal_types": ["soir"], "servings": 4,
    "base": "Steak", "basic": false}',
  '[]', '{}',
  (select id from tests.ids where name = 'steak'));

select results_eq(
  $$select base, basic from public.recipes where id = (select id from tests.ids where name = 'steak')$$,
  $$values ('Steak', false)$$,
  'Une nouvelle sauvegarde change la base et le drapeau basique');

select throws_ok(
  format($$select public.save_recipe('a1000000-0000-4000-8000-000000000001',
    '{"title": "Longue", "meal_types": ["soir"], "servings": 4, "base": "%s"}', '[]', '{}')$$,
    repeat('x', 61)),
  '23514', null,
  'Une base de plus de 60 caractères est refusée');

select lives_ok(
  format($$select public.save_recipe('a1000000-0000-4000-8000-000000000001',
    '{"title": "Juste", "meal_types": ["soir"], "servings": 4, "base": "%s"}', '[]', '{}')$$,
    repeat('x', 60)),
  'Une base de 60 caractères passe');

-- ── Alice copie une recette du catalogue ────────────────────────────────────
insert into tests.ids
select 'copy', public.copy_recipe('cc000000-0000-4000-8000-000000000001',
                                  'a1000000-0000-4000-8000-000000000001');

select results_eq(
  $$select base, basic from public.recipes where id = (select id from tests.ids where name = 'copy')$$,
  $$values ('Côte de porc', true)$$,
  'copy_recipe recopie la base et le drapeau basique');

select results_eq(
  $$select source_recipe_id from public.recipes where id = (select id from tests.ids where name = 'copy')$$,
  $$values ('cc000000-0000-4000-8000-000000000001'::uuid)$$,
  'copy_recipe reste liée à l''originale');

select * from finish();
rollback;
