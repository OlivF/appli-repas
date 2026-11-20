-- Desserts, fruits, fromages (migration 0015) : la sorte d'une recette (recipes.course). La règle
-- « un seul plat par personne et par repas » ne vaut que pour les plats ; les plats légers sont
-- illimités, fusionnés par recette, et la proposition automatique n'y touche jamais.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

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
grant execute on all functions in schema tests to authenticated;

-- Jeu de données, créé en superutilisateur (la RLS ne s'applique pas)
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'olivier@example.com'),
  ('b0000000-0000-4000-8000-000000000002', 'bob@example.com');

insert into public.households (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'Foyer Olivier'),
  ('b1000000-0000-4000-8000-000000000002', 'Foyer Bob');

insert into public.household_users (household_id, user_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');

-- Le foyer de test : Olivier (01), Marie-Laure (02, céto), Timothé (03), Anna-Lucia (04), Otis (05).
insert into public.members (id, household_id, first_name, birth_year, diets) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Olivier', 1986, '{}'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Marie-Laure', 1986, '{keto}'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Timothé', 2010, '{}'),
  ('a2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'Anna-Lucia', 2017, '{}'),
  ('a2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'Otis', 2020, '{}'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Bob', 1980, '{}');

insert into public.recipes (id, household_id, title, meal_types, servings, course) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Gratin', '{soir}', 4, 'main'),
  ('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Poulet rôti keto', '{soir}', 4, 'main'),
  ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Yaourt nature', '{soir}', 1, 'dairy'),
  ('a3000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'Pomme', '{soir}', 1, 'fruit'),
  ('a3000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'Comté', '{soir}', 1, 'cheese'),
  ('a3000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000001', 'Mousse au chocolat', '{soir}', 6, 'dessert');

insert into public.week_plans (id, household_id, week_start) values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-11-23');

-- Lundi soir : gratin pour la famille, poulet pour Marie-Laure, yaourt pour tous, comté pour
-- Marie-Laure. Mercredi soir : un gratin libre (la proposition le remplacera).
insert into public.planned_meals (id, week_plan_id, day, meal_type, position, recipe_id, member_ids) values
  ('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 0, 'soir', 0,
   'a3000000-0000-4000-8000-000000000001',
   '{a2000000-0000-4000-8000-000000000001,a2000000-0000-4000-8000-000000000003,a2000000-0000-4000-8000-000000000004,a2000000-0000-4000-8000-000000000005}'),
  ('a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001', 0, 'soir', 1,
   'a3000000-0000-4000-8000-000000000002', '{a2000000-0000-4000-8000-000000000002}'),
  ('a5000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000001', 0, 'soir', 2,
   'a3000000-0000-4000-8000-000000000003',
   '{a2000000-0000-4000-8000-000000000001,a2000000-0000-4000-8000-000000000002,a2000000-0000-4000-8000-000000000003,a2000000-0000-4000-8000-000000000004,a2000000-0000-4000-8000-000000000005}'),
  ('a5000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000001', 0, 'soir', 3,
   'a3000000-0000-4000-8000-000000000005', '{a2000000-0000-4000-8000-000000000002}'),
  ('a5000000-0000-4000-8000-000000000005', 'a4000000-0000-4000-8000-000000000001', 2, 'soir', 0,
   'a3000000-0000-4000-8000-000000000001',
   '{a2000000-0000-4000-8000-000000000001,a2000000-0000-4000-8000-000000000003}');

-- ── La sorte ────────────────────────────────────────────────────────────────
select is(
  (select course::text from public.recipes
   where household_id = 'a1000000-0000-4000-8000-000000000001' and title = 'Gratin'),
  'main',
  'Une recette est un plat par défaut');

select throws_ok(
  $$insert into public.recipes (household_id, title, meal_types, servings, course, base)
    values ('a1000000-0000-4000-8000-000000000001', 'Tarte aux pommes', '{soir}', 6, 'dessert', 'Pommes')$$,
  '23514', null,
  'Un dessert n''a pas d''élément principal');

select throws_ok(
  $$insert into public.recipes (household_id, title, meal_types, servings, course, basic)
    values ('a1000000-0000-4000-8000-000000000001', 'Clémentines', '{soir}', 1, 'fruit', true)$$,
  '23514', null,
  'Un fruit n''est pas une recette basique');

select tests.login_as('a0000000-0000-4000-8000-000000000001');

-- ── Enregistrer, copier ─────────────────────────────────────────────────────
select lives_ok(
  $$select public.save_recipe(
      'a1000000-0000-4000-8000-000000000001',
      '{"title": "Clémentines", "meal_types": ["soir"], "servings": 1, "course": "fruit", "base": "Clémentines", "basic": true}',
      '[{"name": "Clémentines", "quantity": 2, "unit": "piece", "aisle": "fruits_legumes"}]',
      '{}')$$,
  'save_recipe enregistre un fruit');

select is(
  (select row(course::text, base, basic)::text from public.recipes
   where household_id = 'a1000000-0000-4000-8000-000000000001' and title = 'Clémentines'),
  row('fruit', null::text, false)::text,
  'save_recipe garde la sorte et retire base et basique hors plat');

reset role;
insert into public.recipes (id, household_id, title, meal_types, servings, course) values
  ('c3000000-0000-4000-8000-000000000001', null, 'Emmental du catalogue', '{soir}', 1, 'cheese');
select tests.login_as('a0000000-0000-4000-8000-000000000001');

select public.copy_recipe('c3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001');

select is(
  (select course::text from public.recipes
   where household_id = 'a1000000-0000-4000-8000-000000000001'
     and source_recipe_id = 'c3000000-0000-4000-8000-000000000001'),
  'cheese',
  'copy_recipe recopie la sorte');

-- ── Les mangeurs d'un plat léger ────────────────────────────────────────────
select lives_ok(
  $$select public.set_planned_meal_eaters('a5000000-0000-4000-8000-000000000003', '{a2000000-0000-4000-8000-000000000005}')$$,
  'On change qui mange le yaourt');

select is(
  (select member_ids from public.planned_meals where id = 'a5000000-0000-4000-8000-000000000003'),
  '{a2000000-0000-4000-8000-000000000005}'::uuid[],
  'Le yaourt est pour Otis seul');

select is(
  (select array_agg(cardinality(member_ids) order by position) from public.planned_meals
   where id in ('a5000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002')),
  '{4,1}'::int[],
  'Changer les mangeurs d''un yaourt ne touche pas aux plats');

select is(
  (select locked from public.planned_meals where id = 'a5000000-0000-4000-8000-000000000003'),
  false,
  'Ni à son verrou');

-- ── Les mangeurs d'un plat ──────────────────────────────────────────────────
select lives_ok(
  $$select public.set_planned_meal_eaters('a5000000-0000-4000-8000-000000000001',
      '{a2000000-0000-4000-8000-000000000001,a2000000-0000-4000-8000-000000000002,a2000000-0000-4000-8000-000000000003,a2000000-0000-4000-8000-000000000004,a2000000-0000-4000-8000-000000000005}')$$,
  'Toute la famille passe sur le gratin');

select is(
  (select count(*) from public.planned_meals where id = 'a5000000-0000-4000-8000-000000000002'),
  0::bigint,
  'Le poulet, vidé, disparaît');

select is(
  (select array_agg(member_ids::text order by position) from public.planned_meals
   where id in ('a5000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000004')),
  array['{a2000000-0000-4000-8000-000000000005}', '{a2000000-0000-4000-8000-000000000002}'],
  'Changer les mangeurs d''un plat ne touche pas au yaourt ni au comté');

-- ── Ajouter des plats légers ────────────────────────────────────────────────
select is(
  (select count(*) from public.add_planned_extras(
     'a1000000-0000-4000-8000-000000000001', '2026-11-23',
     '[{"day": 0, "meal_type": "soir", "recipe_id": "a3000000-0000-4000-8000-000000000003",
        "member_ids": ["a2000000-0000-4000-8000-000000000001", "a2000000-0000-4000-8000-000000000005", "a2000000-0000-4000-8000-000000000002"]},
       {"day": 0, "meal_type": "soir", "recipe_id": "a3000000-0000-4000-8000-000000000004",
        "member_ids": ["a2000000-0000-4000-8000-000000000002"]},
       {"day": 1, "meal_type": "soir", "recipe_id": "a3000000-0000-4000-8000-000000000003",
        "member_ids": ["a2000000-0000-4000-8000-000000000004"]}]')),
  3::bigint,
  'add_planned_extras rend les cartes créées ou modifiées');

select is(
  (select array_agg(id) from public.planned_meals
   where week_plan_id = 'a4000000-0000-4000-8000-000000000001' and day = 0
     and recipe_id = 'a3000000-0000-4000-8000-000000000003'),
  '{a5000000-0000-4000-8000-000000000003}'::uuid[],
  'Une recette déjà au repas n''est pas ajoutée une seconde fois');

select is(
  (select member_ids from public.planned_meals where id = 'a5000000-0000-4000-8000-000000000003'),
  '{a2000000-0000-4000-8000-000000000005,a2000000-0000-4000-8000-000000000001,a2000000-0000-4000-8000-000000000002}'::uuid[],
  'Ses mangeurs fusionnent, dans l''ordre');

select is(
  (select position from public.planned_meals
   where week_plan_id = 'a4000000-0000-4000-8000-000000000001' and day = 0
     and recipe_id = 'a3000000-0000-4000-8000-000000000004'),
  4::smallint,
  'La pomme se pose après les cartes du repas');

select is(
  (select count(*) from public.planned_meals
   where week_plan_id = 'a4000000-0000-4000-8000-000000000001' and day = 0 and meal_type = 'soir'
     and 'a2000000-0000-4000-8000-000000000002' = any (member_ids)),
  4::bigint,
  'Marie-Laure a un plat et trois plats légers au même repas');

select throws_ok(
  $$select * from public.add_planned_extras('a1000000-0000-4000-8000-000000000001', '2026-11-23',
      '[{"day": 0, "meal_type": "soir", "recipe_id": "a3000000-0000-4000-8000-000000000002",
         "member_ids": ["a2000000-0000-4000-8000-000000000002"]}]')$$,
  '23514', null,
  'add_planned_extras refuse un plat');

select throws_ok(
  $$select public.add_planned_meal('a1000000-0000-4000-8000-000000000001', '2026-11-23', 0::smallint, 'soir',
      'a3000000-0000-4000-8000-000000000006', '{a2000000-0000-4000-8000-000000000001}')$$,
  '23514', null,
  'add_planned_meal refuse un dessert');

-- Le poulet pour Marie-Laure : elle quitte le gratin, pas ses plats légers.
select lives_ok(
  $$select public.add_planned_meal('a1000000-0000-4000-8000-000000000001', '2026-11-23', 0::smallint, 'soir',
      'a3000000-0000-4000-8000-000000000002', '{a2000000-0000-4000-8000-000000000002}')$$,
  'On ajoute le poulet pour Marie-Laure');

select is(
  (select count(*) from public.planned_meals p
   join public.recipes r on r.id = p.recipe_id
   where p.week_plan_id = 'a4000000-0000-4000-8000-000000000001' and p.day = 0
     and 'a2000000-0000-4000-8000-000000000002' = any (p.member_ids)
     and r.course <> 'main'),
  3::bigint,
  'Elle garde ses trois plats légers');

select is(
  (select cardinality(member_ids) from public.planned_meals where id = 'a5000000-0000-4000-8000-000000000001'),
  4,
  'Et quitte le gratin');

-- ── Proposer la semaine ─────────────────────────────────────────────────────
select lives_ok(
  $$select public.save_week_proposal('a1000000-0000-4000-8000-000000000001', '2026-11-23', 1,
      '[{"day": 1, "meal_type": "soir", "position": 1, "recipe_id": "a3000000-0000-4000-8000-000000000001",
         "member_ids": ["a2000000-0000-4000-8000-000000000001"]}]')$$,
  'On relance la semaine');

select is(
  (select count(*) from public.planned_meals where id = 'a5000000-0000-4000-8000-000000000005'),
  0::bigint,
  'Le plat libre de mercredi est remplacé');

select is(
  (select count(*) from public.planned_meals p
   join public.recipes r on r.id = p.recipe_id
   where p.week_plan_id = 'a4000000-0000-4000-8000-000000000001' and r.course <> 'main'),
  4::bigint,
  'Les plats légers non verrouillés restent');

select throws_ok(
  $$select public.save_week_proposal('a1000000-0000-4000-8000-000000000001', '2026-11-23', 2,
      '[{"day": 3, "meal_type": "soir", "position": 0, "recipe_id": "a3000000-0000-4000-8000-000000000003",
         "member_ids": ["a2000000-0000-4000-8000-000000000001"]}]')$$,
  '23514', null,
  'La proposition refuse un plat léger');

-- ── Échanger ────────────────────────────────────────────────────────────────
select throws_ok(
  format($$select public.swap_planned_meals('a5000000-0000-4000-8000-000000000003', %L)$$,
    (select id from public.planned_meals
     where week_plan_id = 'a4000000-0000-4000-8000-000000000001' and day = 1
       and recipe_id = 'a3000000-0000-4000-8000-000000000001')),
  'P0001', null,
  'Un yaourt ne s''échange pas avec un plat');

-- ── Un autre foyer ──────────────────────────────────────────────────────────
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select throws_ok(
  $$select * from public.add_planned_extras('a1000000-0000-4000-8000-000000000001', '2026-11-23',
      '[{"day": 4, "meal_type": "soir", "recipe_id": "a3000000-0000-4000-8000-000000000003",
         "member_ids": ["a2000000-0000-4000-8000-000000000001"]}]')$$,
  '42501', null,
  'Bob ne peut rien ajouter chez Olivier');

-- ── Référentiel ─────────────────────────────────────────────────────────────
reset role;

select is(
  (select row(aisle::text, shopping_unit::text, shelf_life_days > 0)::text from public.ingredients
   where household_id is null and name = 'Yaourt à la grecque'),
  row('cremerie', 'g', true)::text,
  'Le yaourt à la grecque est au référentiel, au poids');

select is(
  (select array_agg(name || ':' || piece_grams::int order by name) from public.ingredients
   where household_id is null
     and name in ('Camembert', 'Chocolat noir', 'Comté', 'Emmental', 'Fraises', 'Fromage blanc', 'Fromage de chèvre', 'Raisin')),
  array['Camembert:250', 'Chocolat noir:100', 'Comté:250', 'Emmental:250', 'Fraises:250', 'Fromage blanc:500',
        'Fromage de chèvre:180', 'Raisin:500'],
  'Les pièces des plats légers comptés en grammes ont leur poids');

select * from finish();
rollback;
