-- Planning de la semaine : semaines et cartes restent dans leur foyer ; une proposition
-- s'écrit d'un coup en gardant les cartes verrouillées.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

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
grant execute on all functions in schema tests to authenticated, anon;

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

insert into public.members (id, household_id, first_name, birth_year) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Alice', 1985),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Arthur', 2018),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Agathe', 2016),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Bob', 1980);

insert into public.recipes (id, household_id, title, meal_types, servings) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Soupe d''Alice', '{soir}', 4),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Gratin d''Alice', '{soir}', 4),
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Tarte de Bob', '{soir}', 4);

-- ── Alice propose sa semaine ────────────────────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

select isnt(
  public.save_week_proposal(
    'a1000000-0000-4000-8000-000000000001', '2026-11-23', 1,
    $$[
      {"day": 0, "meal_type": "soir", "position": 0,
       "recipe_id": "a3000000-0000-4000-8000-000000000001",
       "member_ids": ["a2000000-0000-4000-8000-000000000001", "a2000000-0000-4000-8000-000000000002"]},
      {"day": 1, "meal_type": "soir", "position": 0,
       "recipe_id": "ca7a0000-0000-4000-8000-000000000022",
       "member_ids": ["a2000000-0000-4000-8000-000000000001"]}
    ]$$::jsonb),
  null,
  'save_week_proposal crée la semaine et rend son id');

select results_eq(
  $$select count(*)::int, min(seed) from public.week_plans$$,
  $$values (1, 1)$$,
  'Une semaine, avec sa graine');

select results_eq(
  $$select count(*)::int from public.planned_meals
    where household_id = 'a1000000-0000-4000-8000-000000000001'$$,
  $$values (2)$$,
  'Les deux cartes sont enregistrées, avec le foyer de la semaine');

-- Alice verrouille le lundi, puis relance : seule la carte non verrouillée est remplacée.
update public.planned_meals set locked = true where day = 0;

select public.save_week_proposal(
  'a1000000-0000-4000-8000-000000000001', '2026-11-23', 2,
  $$[{"day": 1, "meal_type": "soir", "position": 0,
      "recipe_id": "a3000000-0000-4000-8000-000000000002",
      "member_ids": ["a2000000-0000-4000-8000-000000000001"]}]$$::jsonb);

select results_eq(
  $$select day::int, recipe_id, locked from public.planned_meals order by day$$,
  $$values (0, 'a3000000-0000-4000-8000-000000000001'::uuid, true),
           (1, 'a3000000-0000-4000-8000-000000000002'::uuid, false)$$,
  'Relancer garde la carte verrouillée et remplace les autres');

select results_eq(
  $$select seed from public.week_plans$$,
  $$values (2)$$,
  'Relancer enregistre la nouvelle graine');

select results_eq(
  $$select member_ids from public.planned_meals where day = 0$$,
  $$values (array['a2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002']::uuid[])$$,
  'Les mangeurs de la carte sont gardés');

-- ── Cohérence ───────────────────────────────────────────────────────────────
select throws_ok(
  $$insert into public.week_plans (household_id, week_start)
    values ('a1000000-0000-4000-8000-000000000001', '2026-11-24')$$,
  '23514', null,
  'Une semaine commence un lundi');

select throws_ok(
  $$insert into public.planned_meals (week_plan_id, day, meal_type, recipe_id, member_ids)
    select id, 2, 'soir', 'b3000000-0000-4000-8000-000000000001',
           array['a2000000-0000-4000-8000-000000000001']::uuid[]
    from public.week_plans$$,
  '23503', null,
  'Pas de recette d''un autre foyer dans la semaine');

select throws_ok(
  $$insert into public.planned_meals (week_plan_id, day, meal_type, recipe_id, member_ids)
    select id, 2, 'soir', 'a3000000-0000-4000-8000-000000000001',
           array['b2000000-0000-4000-8000-000000000001']::uuid[]
    from public.week_plans$$,
  '23503', null,
  'Pas de membre d''un autre foyer sur une carte');

select lives_ok(
  $$insert into public.planned_meals (week_plan_id, day, meal_type, recipe_id, member_ids)
    select id, 3, 'soir', 'a3000000-0000-4000-8000-000000000001',
           array['a2000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003']::uuid[]
    from public.week_plans$$,
  'Alice ajoute une carte à la main');

select results_eq(
  $$select household_id, member_ids from public.planned_meals where day = 3$$,
  $$values ('a1000000-0000-4000-8000-000000000001'::uuid,
            array['a2000000-0000-4000-8000-000000000003']::uuid[])$$,
  'La carte prend le foyer de sa semaine, sans membre en double');

-- ── Échanger deux cartes ────────────────────────────────────────────────────
select lives_ok(
  $$select public.swap_planned_meals(
      (select id from public.planned_meals where day = 1),
      (select id from public.planned_meals where day = 3))$$,
  'Alice échange deux cartes');

select results_eq(
  $$select day::int, recipe_id, member_ids from public.planned_meals where day in (1, 3) order by day$$,
  $$values (1, 'a3000000-0000-4000-8000-000000000001'::uuid, array['a2000000-0000-4000-8000-000000000001']::uuid[]),
           (3, 'a3000000-0000-4000-8000-000000000002'::uuid, array['a2000000-0000-4000-8000-000000000003']::uuid[])$$,
  'Les recettes s''échangent, les mangeurs restent à leur place');

select throws_ok(
  $$select public.swap_planned_meals(
      (select id from public.planned_meals where day = 0),
      (select id from public.planned_meals where day = 1))$$,
  'P0001', null,
  'Une carte verrouillée ne s''échange pas');

-- ── Bob ne voit ni ne touche le planning d'Alice ────────────────────────────
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select is_empty($$select 1 from public.week_plans$$, 'Bob ne voit pas la semaine d''Alice');
select is_empty($$select 1 from public.planned_meals$$, 'Bob ne voit pas les cartes d''Alice');

select is(
  tests.rows_affected($$update public.planned_meals set locked = false$$),
  0::bigint,
  'Bob ne peut pas modifier les cartes d''Alice');

select throws_ok(
  $$select public.save_week_proposal(
      'a1000000-0000-4000-8000-000000000001', '2026-11-30', 1, '[]'::jsonb)$$,
  '42501', null,
  'Bob ne peut pas proposer une semaine chez Alice');

select throws_ok(
  $$select public.swap_planned_meals(
      'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002')$$,
  'P0001', null,
  'Bob ne peut pas échanger de cartes qu''il ne voit pas');

-- ── Suppressions et copie ───────────────────────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

-- Le catalogue (saumon) revient le mardi, puis Alice le copie.
update public.planned_meals set recipe_id = 'ca7a0000-0000-4000-8000-000000000022' where day = 1;
select public.copy_recipe('ca7a0000-0000-4000-8000-000000000022', 'a1000000-0000-4000-8000-000000000001');

select results_eq(
  $$select r.source_recipe_id from public.planned_meals p
    join public.recipes r on r.id = p.recipe_id where p.day = 1$$,
  $$values ('ca7a0000-0000-4000-8000-000000000022'::uuid)$$,
  'Copier une recette du catalogue y déplace les cartes du foyer');

delete from public.recipes where id = 'a3000000-0000-4000-8000-000000000002';

select is_empty(
  $$select 1 from public.planned_meals where day = 3$$,
  'Une recette supprimée fait disparaître sa carte');

delete from public.members where id = 'a2000000-0000-4000-8000-000000000002';

select results_eq(
  $$select member_ids from public.planned_meals where day = 0$$,
  $$values (array['a2000000-0000-4000-8000-000000000001']::uuid[])$$,
  'Un membre supprimé quitte ses cartes');

delete from public.members where id = 'a2000000-0000-4000-8000-000000000001';

select is_empty(
  $$select 1 from public.planned_meals$$,
  'Une carte sans plus personne disparaît');

-- ── Sans compte ─────────────────────────────────────────────────────────────
reset role;
set local role anon;

select throws_ok(
  $$select 1 from public.planned_meals$$,
  '42501', null,
  'Un visiteur non connecté ne lit pas le planning');

select * from finish();
rollback;
