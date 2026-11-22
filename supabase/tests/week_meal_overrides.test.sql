-- Les repas d'une semaine (migration 0019) : le réglage du foyer reste le modèle, une semaine peut
-- retirer un repas, en ajouter un, ou changer qui est là ; les plats suivent.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

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

-- Jeu de données, créé en superutilisateur (la RLS ne s'applique pas).
insert into auth.users (id, email) values
  ('c0000000-0000-4000-8000-000000000001', 'olivier@example.com'),
  ('d0000000-0000-4000-8000-000000000001', 'bob@example.com');

insert into public.households (id, name) values
  ('c1000000-0000-4000-8000-000000000001', 'Famille de test'),
  ('d1000000-0000-4000-8000-000000000001', 'Foyer Bob');

insert into public.household_users (household_id, user_id) values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001');

-- Olivier, Marie-Laure (céto), Timothé, Anna-Lucia, Otis ; Bob.
insert into public.members (id, household_id, first_name, birth_year, created_at) values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Olivier', 1986, now()),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Marie-Laure', 1986, now() + interval '1 s'),
  ('c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'Timothé', 2010, now() + interval '2 s'),
  ('c2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'Anna-Lucia', 2017, now() + interval '3 s'),
  ('c2000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'Otis', 2020, now() + interval '4 s'),
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Bob', 1980, now());

-- Le foyer : petit-déj et dîner pour tous, tous les jours ; midi Marie-Laure lun/mar/jeu/ven.
insert into public.meal_slots (household_id, day, meal_type, member_ids)
select 'c1000000-0000-4000-8000-000000000001', day, meal::public.meal_type,
       '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000002,c2000000-0000-4000-8000-000000000003,c2000000-0000-4000-8000-000000000004,c2000000-0000-4000-8000-000000000005}'
from generate_series(0, 6) as day, unnest(array['petit_dej', 'soir']) as meal;
insert into public.meal_slots (household_id, day, meal_type, member_ids)
select 'c1000000-0000-4000-8000-000000000001', day, 'midi', '{c2000000-0000-4000-8000-000000000002}'
from unnest(array[0, 1, 3, 4]) as day;
insert into public.meal_slots (household_id, day, meal_type, member_ids) values
  ('d1000000-0000-4000-8000-000000000001', 0, 'soir', '{d2000000-0000-4000-8000-000000000001}');

insert into public.recipes (id, household_id, title, meal_types, servings, course) values
  ('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Poulet rôti', '{midi,soir}', 4, 'main'),
  ('c3000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Poulet céto', '{soir}', 1, 'main'),
  ('c3000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'Gratin', '{soir}', 4, 'main'),
  ('c3000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'Yaourt nature', '{midi,soir}', 1, 'dairy');

insert into public.week_plans (id, household_id, week_start) values
  ('c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '2026-11-23'),
  ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '2026-11-23');

-- Lundi soir : poulet rôti pour quatre, poulet céto pour Marie-Laure, yaourt pour tous.
-- Dimanche soir : gratin pour tous.
insert into public.planned_meals (id, week_plan_id, day, meal_type, position, recipe_id, member_ids, locked) values
  ('c5000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 0, 'soir', 0,
   'c3000000-0000-4000-8000-000000000001',
   '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000003,c2000000-0000-4000-8000-000000000004,c2000000-0000-4000-8000-000000000005}', false),
  ('c5000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001', 0, 'soir', 1,
   'c3000000-0000-4000-8000-000000000002', '{c2000000-0000-4000-8000-000000000002}', true),
  ('c5000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000001', 0, 'soir', 2,
   'c3000000-0000-4000-8000-000000000004',
   '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000002,c2000000-0000-4000-8000-000000000003,c2000000-0000-4000-8000-000000000004,c2000000-0000-4000-8000-000000000005}', false),
  ('c5000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000001', 6, 'soir', 0,
   'c3000000-0000-4000-8000-000000000003',
   '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000002,c2000000-0000-4000-8000-000000000003,c2000000-0000-4000-8000-000000000004,c2000000-0000-4000-8000-000000000005}', false);

create temp view overrides as
select day, meal_type::text, member_ids::text[]
from public.week_meal_overrides
where week_plan_id = 'c4000000-0000-4000-8000-000000000001';
grant select on overrides to authenticated;

select tests.login_as('c0000000-0000-4000-8000-000000000001');

-- ── Lundi soir sans Marie-Laure ─────────────────────────────────────────────
select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 0::smallint, 'soir',
  '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000003,c2000000-0000-4000-8000-000000000004,c2000000-0000-4000-8000-000000000005}');

select results_eq(
  $$select * from overrides$$,
  $$values (0::smallint, 'soir', array['c2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000005'])$$,
  'Lundi soir sans Marie-Laure : une exception pour cette semaine');

select is(
  (select count(*) from public.planned_meals where id = 'c5000000-0000-4000-8000-000000000002'),
  0::bigint,
  'Son poulet céto (pour elle seule, même verrouillé) est supprimé');

select is(
  (select cardinality(member_ids) from public.planned_meals where id = 'c5000000-0000-4000-8000-000000000001'),
  4,
  'Le poulet rôti des quatre autres ne bouge pas');

select is(
  (select member_ids::text[] from public.planned_meals where id = 'c5000000-0000-4000-8000-000000000003'),
  array['c2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000005'],
  'Elle quitte aussi le yaourt, les autres le gardent dans le même ordre');

select is(
  private.week_slot_members('c4000000-0000-4000-8000-000000000001', 0::smallint, 'soir'),
  '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000003,c2000000-0000-4000-8000-000000000004,c2000000-0000-4000-8000-000000000005}'::uuid[],
  'week_slot_members rend les présents de l''exception');

select is(
  cardinality(private.week_slot_members('c4000000-0000-4000-8000-000000000001', 1::smallint, 'soir')),
  5,
  'Sans exception : les présents du foyer');

-- ── Comme d'habitude (même ensemble, autre ordre) ───────────────────────────
select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 0::smallint, 'soir',
  '{c2000000-0000-4000-8000-000000000005,c2000000-0000-4000-8000-000000000004,c2000000-0000-4000-8000-000000000003,c2000000-0000-4000-8000-000000000002,c2000000-0000-4000-8000-000000000001}');

select is((select count(*) from overrides), 0::bigint, 'Le réglage du foyer, dans un autre ordre : l''exception disparaît');

-- ── Pas de dîner dimanche ───────────────────────────────────────────────────
select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 6::smallint, 'soir', '{}');

select results_eq(
  $$select * from overrides$$,
  $$values (6::smallint, 'soir', '{}'::text[])$$,
  'Dimanche soir : une exception vide (pas de repas cette semaine)');

select is(
  (select count(*) from public.planned_meals where week_plan_id = 'c4000000-0000-4000-8000-000000000001' and day = 6),
  0::bigint,
  'Le gratin du dimanche soir est supprimé');

select is(
  private.week_slot_members('c4000000-0000-4000-8000-000000000001', 6::smallint, 'soir'),
  '{}'::uuid[],
  'week_slot_members : personne dimanche soir');

-- ── Samedi midi pour tous, avec un plat ─────────────────────────────────────
select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 5::smallint, 'midi',
  '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000002,c2000000-0000-4000-8000-000000000001}');

select is(
  (select member_ids::text[] from overrides where day = 5),
  array['c2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002'],
  'Samedi midi ajouté pour Olivier et Marie-Laure, sans doublon, dans l''ordre donné');

select lives_ok(
  $$select public.add_planned_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 5::smallint, 'midi',
    'c3000000-0000-4000-8000-000000000001', '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000002}')$$,
  'Un plat se pose sur le repas ajouté');

-- ── Tout remettre comme d'habitude ──────────────────────────────────────────
select public.reset_week_meals('c1000000-0000-4000-8000-000000000001', '2026-11-23');

select is((select count(*) from overrides), 0::bigint, 'reset_week_meals : plus aucune exception');

select is(
  (select count(*) from public.planned_meals where week_plan_id = 'c4000000-0000-4000-8000-000000000001' and day = 5),
  0::bigint,
  'Le samedi midi n''a plus lieu : son plat est supprimé');

select is(
  (select array_agg(id order by id) from unnest(private.week_slot_members('c4000000-0000-4000-8000-000000000001', 6::smallint, 'soir')) as id),
  '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000002,c2000000-0000-4000-8000-000000000003,c2000000-0000-4000-8000-000000000004,c2000000-0000-4000-8000-000000000005}'::uuid[],
  'Le dîner du dimanche revient, pour tout le foyer (le créneau ne garde pas d''ordre)');

-- ── Une semaine jamais ouverte ──────────────────────────────────────────────
select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-30', 6::smallint, 'soir', '{}');

select is(
  (select count(*) from public.week_meal_overrides o
   join public.week_plans w on w.id = o.week_plan_id
   where w.household_id = 'c1000000-0000-4000-8000-000000000001' and w.week_start = '2026-11-30'),
  1::bigint,
  'set_week_meal crée la semaine au besoin');

select throws_ok(
  $$select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 0::smallint, 'soir',
    '{d2000000-0000-4000-8000-000000000001}')$$,
  '23503', null,
  'Un membre d''un autre foyer ne peut pas être présent');

-- ── Un autre foyer ──────────────────────────────────────────────────────────
select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 6::smallint, 'soir', '{}');

select tests.login_as('d0000000-0000-4000-8000-000000000001');

select is((select count(*) from public.week_meal_overrides), 0::bigint, 'Bob ne voit pas les exceptions d''Olivier');

select is(
  tests.rows_affected($$delete from public.week_meal_overrides where week_plan_id = 'c4000000-0000-4000-8000-000000000001'$$),
  0::bigint,
  'Bob ne peut pas les supprimer');

select throws_ok(
  $$insert into public.week_meal_overrides (week_plan_id, day, meal_type, member_ids)
    values ('c4000000-0000-4000-8000-000000000001', 1, 'soir', '{}')$$,
  '23503', null,
  'Bob ne peut pas en ajouter dans la semaine d''Olivier (il ne la voit pas)');

select throws_ok(
  $$select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 1::smallint, 'soir', '{}')$$,
  '42501', null,
  'Bob ne peut pas changer un repas d''Olivier');

select throws_ok(
  $$select public.reset_week_meals('c1000000-0000-4000-8000-000000000001', '2026-11-23')$$,
  '42501', null,
  'Bob ne peut pas tout remettre chez Olivier');

-- ── Un membre supprimé ──────────────────────────────────────────────────────
select tests.login_as('c0000000-0000-4000-8000-000000000001');
select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 5::smallint, 'midi',
  '{c2000000-0000-4000-8000-000000000002}');
select public.set_week_meal('c1000000-0000-4000-8000-000000000001', '2026-11-23', 0::smallint, 'soir',
  '{c2000000-0000-4000-8000-000000000001,c2000000-0000-4000-8000-000000000002}');

delete from public.members where id = 'c2000000-0000-4000-8000-000000000002';

select results_eq(
  $$select * from overrides order by day$$,
  $$values (0::smallint, 'soir', array['c2000000-0000-4000-8000-000000000001']),
           (6::smallint, 'soir', '{}'::text[])$$,
  'Marie-Laure supprimée : elle quitte le lundi soir, son samedi midi disparaît, le dimanche reste sans dîner');

select is(
  (select count(*) from public.week_meal_overrides where member_ids = '{}'),
  2::bigint,
  'Aucune exception vide créée par la suppression (dimanche ici, dimanche de la semaine suivante)');

select * from finish();
rollback;
