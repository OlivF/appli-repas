-- Plusieurs plats sur un même repas (migration 0008) : chaque présent mange un seul plat ;
-- poser les mangeurs d'une carte les retire des autres cartes du repas, une carte vidée
-- disparaît ; on peut ajouter un plat pour certains membres, et retirer un plat.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

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
grant execute on all functions in schema tests to authenticated;

create table tests.ids (name text primary key, id uuid not null);
grant all on tests.ids to authenticated;

-- Jeu de données, créé en superutilisateur (la RLS ne s'applique pas)
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@example.com'),
  ('b0000000-0000-4000-8000-000000000002', 'bob@example.com');

insert into public.households (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'Foyer Alice'),
  ('b1000000-0000-4000-8000-000000000002', 'Foyer Bob');

insert into public.household_users (household_id, user_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');

-- Alice (céto), Arthur, Agathe ; Bob.
insert into public.members (id, household_id, first_name, birth_year) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Alice', 1985),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Arthur', 2018),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Agathe', 2016),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Bob', 1980);

insert into public.recipes (id, household_id, title, meal_types, servings) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Steak haché et frites', '{soir}', 4),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Steak haché et haricots verts', '{soir}', 4),
  ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Pâtes au pesto', '{soir}', 4),
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Tarte de Bob', '{soir}', 4);

insert into public.week_plans (id, household_id, week_start) values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-11-23'),
  ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '2026-11-23');

-- Lundi soir chez Alice : frites pour Arthur et Agathe, haricots verts pour Alice ;
-- mardi soir : frites pour les trois (un autre repas, jamais touché).
insert into public.planned_meals (id, week_plan_id, day, meal_type, position, recipe_id, member_ids) values
  ('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 0, 'soir', 0,
   'a3000000-0000-4000-8000-000000000001',
   '{a2000000-0000-4000-8000-000000000002,a2000000-0000-4000-8000-000000000003}'),
  ('a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001', 0, 'soir', 1,
   'a3000000-0000-4000-8000-000000000002', '{a2000000-0000-4000-8000-000000000001}'),
  ('a5000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000001', 1, 'soir', 0,
   'a3000000-0000-4000-8000-000000000001',
   '{a2000000-0000-4000-8000-000000000001,a2000000-0000-4000-8000-000000000002,a2000000-0000-4000-8000-000000000003}'),
  ('b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 0, 'soir', 0,
   'b3000000-0000-4000-8000-000000000001', '{b2000000-0000-4000-8000-000000000001}');

create temp view monday as
select id, position, recipe_id, member_ids, locked
from public.planned_meals
where week_plan_id = 'a4000000-0000-4000-8000-000000000001' and day = 0 and meal_type = 'soir';
grant select on monday to authenticated;

select tests.login_as('a0000000-0000-4000-8000-000000000001');

-- ── Poser les mangeurs d'une carte ──────────────────────────────────────────
select public.set_planned_meal_eaters('a5000000-0000-4000-8000-000000000002',
  '{a2000000-0000-4000-8000-000000000001,a2000000-0000-4000-8000-000000000002}');

select results_eq(
  $$select id::text, member_ids::text[], locked from monday order by position$$,
  $$values ('a5000000-0000-4000-8000-000000000001', array['a2000000-0000-4000-8000-000000000003'], false),
           ('a5000000-0000-4000-8000-000000000002',
            array['a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002'], true)$$,
  'Arthur passe sur les haricots verts : il quitte les frites ; la carte choisie se verrouille');

select public.set_planned_meal_eaters('a5000000-0000-4000-8000-000000000002',
  '{a2000000-0000-4000-8000-000000000001,a2000000-0000-4000-8000-000000000002,a2000000-0000-4000-8000-000000000003}');

select results_eq(
  $$select id::text, cardinality(member_ids) from monday$$,
  $$values ('a5000000-0000-4000-8000-000000000002', 3)$$,
  'Les frites n''ont plus personne : la carte disparaît');

select is(
  (select cardinality(member_ids) from public.planned_meals where id = 'a5000000-0000-4000-8000-000000000003'),
  3,
  'Un autre repas n''est jamais touché');

select throws_ok(
  $$select public.set_planned_meal_eaters('a5000000-0000-4000-8000-000000000002', '{}')$$,
  '23514', null,
  'Un plat sans mangeur est refusé (pour l''enlever : le retirer)');

select throws_ok(
  $$select public.set_planned_meal_eaters('b5000000-0000-4000-8000-000000000001',
    '{a2000000-0000-4000-8000-000000000001}')$$,
  'P0002', null,
  'Alice ne peut pas poser les mangeurs d''une carte de Bob');

select throws_ok(
  $$select public.set_planned_meal_eaters('a5000000-0000-4000-8000-000000000002',
    '{b2000000-0000-4000-8000-000000000001}')$$,
  '23503', null,
  'Un membre de Bob ne peut pas manger chez Alice');

-- ── Ajouter un plat pour certains membres ───────────────────────────────────
insert into tests.ids
select 'pesto', public.add_planned_meal('a1000000-0000-4000-8000-000000000001', '2026-11-23', 0::smallint,
  'soir', 'a3000000-0000-4000-8000-000000000003', '{a2000000-0000-4000-8000-000000000003}');

select results_eq(
  $$select recipe_id::text, position::int, member_ids::text[], locked from monday
    where id = (select id from tests.ids where name = 'pesto')$$,
  $$values ('a3000000-0000-4000-8000-000000000003', 2, array['a2000000-0000-4000-8000-000000000003'], true)$$,
  'add_planned_meal ajoute une carte verrouillée, après les autres, pour Agathe');

select results_eq(
  $$select member_ids::text[] from monday where id = 'a5000000-0000-4000-8000-000000000002'$$,
  $$values (array['a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002'])$$,
  'Agathe quitte le plat qu''elle mangeait');

insert into tests.ids
select 'mercredi', public.add_planned_meal('a1000000-0000-4000-8000-000000000001', '2026-11-30', 2::smallint,
  'soir', 'a3000000-0000-4000-8000-000000000003', '{a2000000-0000-4000-8000-000000000001}');

select results_eq(
  $$select w.week_start, p.position::int from public.planned_meals p
    join public.week_plans w on w.id = p.week_plan_id
    where p.id = (select id from tests.ids where name = 'mercredi')$$,
  $$values ('2026-11-30'::date, 0)$$,
  'add_planned_meal crée la semaine qui n''existe pas encore');

select throws_ok(
  $$select public.add_planned_meal('b1000000-0000-4000-8000-000000000002', '2026-11-23', 0::smallint,
    'soir', 'b3000000-0000-4000-8000-000000000001', '{b2000000-0000-4000-8000-000000000001}')$$,
  '42501', null,
  'Alice ne peut pas ajouter un plat chez Bob');

select throws_ok(
  $$select public.add_planned_meal('a1000000-0000-4000-8000-000000000001', '2026-11-23', 0::smallint,
    'soir', 'a3000000-0000-4000-8000-000000000003', '{}')$$,
  '23514', null,
  'Un plat ajouté pour personne est refusé');

-- ── Retirer un plat ─────────────────────────────────────────────────────────
select is(
  tests.rows_affected($$delete from public.planned_meals where id = (select id from tests.ids where name = 'pesto')$$),
  1::bigint,
  'Alice retire un plat de sa semaine');

select is(
  tests.rows_affected($$delete from public.planned_meals where id = 'b5000000-0000-4000-8000-000000000001'$$),
  0::bigint,
  'Alice ne peut pas retirer un plat de Bob');

reset role;
select is(
  (select count(*) from public.planned_meals where id = 'b5000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Le plat de Bob est toujours là');

select * from finish();
rollback;
