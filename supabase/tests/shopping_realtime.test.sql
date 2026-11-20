-- Liste de courses en direct (migration 0014) : les deux tables sont dans la publication
-- Realtime ; supprimer un article « touche » sa liste (updated_at), ce que l'autre téléphone
-- reçoit à travers la RLS. Que la RLS filtre bien les événements : e2e/realtime-rls.spec.ts.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

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

-- Jeu de données, créé en superutilisateur (la RLS ne s'applique pas).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@example.com'),
  ('b0000000-0000-4000-8000-000000000002', 'bob@example.com');

insert into public.households (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'Foyer Alice'),
  ('b1000000-0000-4000-8000-000000000002', 'Foyer Bob');

insert into public.household_users (household_id, user_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');

insert into public.week_plans (id, household_id, week_start) values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-11-23'),
  ('a4000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '2026-11-30'),
  ('b4000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', '2026-11-23');

insert into public.shopping_lists (id, week_plan_id, updated_at) values
  ('a5000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', '2000-01-01'),
  ('a5000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002', '2000-01-01'),
  ('b5000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', '2000-01-01');

insert into public.shopping_items (id, list_id, label, manual) values
  ('a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'Bougies', true),
  ('a6000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001', 'Œufs', true),
  ('a6000000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000002', 'Lait', true),
  ('b6000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'Pain', true);

-- ── Publication ─────────────────────────────────────────────────────────────
select results_eq(
  $$select tablename::text collate "C" from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename like 'shopping_%'
    order by tablename$$,
  $$values ('shopping_items' collate "C"), ('shopping_lists')$$,
  'La liste et ses articles sont diffusés en direct');

select ok(
  not has_function_privilege('authenticated', 'private.touch_lists_after_item_delete()', 'execute'),
  'La fonction du trigger ne s''appelle pas depuis l''API');

-- ── Bob ne touche pas la liste d'Alice ──────────────────────────────────────
select tests.login_as('b0000000-0000-4000-8000-000000000002');
delete from public.shopping_items where id = 'a6000000-0000-4000-8000-000000000001';
reset role;

select is(
  (select updated_at from public.shopping_lists where id = 'a5000000-0000-4000-8000-000000000001'),
  '2000-01-01'::timestamptz,
  'Une suppression refusée par la RLS ne touche pas la liste');

-- ── Alice supprime un article ajouté à la main ──────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');
delete from public.shopping_items where id = 'a6000000-0000-4000-8000-000000000001';
reset role;

select is(
  (select updated_at from public.shopping_lists where id = 'a5000000-0000-4000-8000-000000000001'),
  now(),
  'Supprimer un article touche sa liste : l''autre téléphone recharge');

select is(
  (select updated_at from public.shopping_lists where id = 'a5000000-0000-4000-8000-000000000002'),
  '2000-01-01'::timestamptz,
  'Les autres listes du foyer ne bougent pas');

select is(
  (select updated_at from public.shopping_lists where id = 'b5000000-0000-4000-8000-000000000001'),
  '2000-01-01'::timestamptz,
  'Les listes des autres foyers ne bougent pas');

-- ── Une suppression groupée touche chaque liste une fois ────────────────────
-- (Seulement les données de ce test : la base locale garde celles des e2e.)
update public.shopping_lists set updated_at = '2000-01-01'
where id in ('a5000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000002',
             'b5000000-0000-4000-8000-000000000001');
delete from public.shopping_items
where id in ('a6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000003');

select results_eq(
  $$select id from public.shopping_lists where updated_at = now() and household_id in
      ('a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by id$$,
  $$values ('a5000000-0000-4000-8000-000000000001'::uuid), ('a5000000-0000-4000-8000-000000000002'::uuid)$$,
  'Une suppression sur deux listes touche les deux');

select * from finish();
rollback;
