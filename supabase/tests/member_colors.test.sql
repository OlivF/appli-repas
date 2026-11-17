-- Couleur des membres : la première libre du foyer, attribuée à l'ajout, puis fixe.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

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

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@example.com'),
  ('b0000000-0000-4000-8000-000000000002', 'bob@example.com');

insert into public.households (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'Foyer Alice'),
  ('b1000000-0000-4000-8000-000000000002', 'Foyer Bob');

insert into public.household_users (household_id, user_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');

select tests.login_as('a0000000-0000-4000-8000-000000000001');

insert into public.members (household_id, first_name, birth_year) values
  ('a1000000-0000-4000-8000-000000000001', 'Alice', 1985);
insert into public.members (household_id, first_name, birth_year) values
  ('a1000000-0000-4000-8000-000000000001', 'Arthur', 2018);

select results_eq(
  'select first_name, color::int from public.members order by color',
  $$values ('Alice', 0), ('Arthur', 1)$$,
  'Chaque nouveau membre reçoit la première couleur libre');

delete from public.members where first_name = 'Alice';
insert into public.members (household_id, first_name, birth_year) values
  ('a1000000-0000-4000-8000-000000000001', 'Anna', 2016);

select results_eq(
  'select first_name, color::int from public.members order by color',
  $$values ('Anna', 0), ('Arthur', 1)$$,
  'La couleur d''un membre retiré redevient libre ; les autres ne changent pas');

insert into public.members (household_id, first_name, birth_year)
select 'a1000000-0000-4000-8000-000000000001', 'Enfant ' || n, 2015
from generate_series(1, 6) as n;

select is(
  (select array_agg(color order by color)::int[] from public.members),
  array[0, 1, 2, 3, 4, 5, 6, 7],
  'Un ajout en lot donne une couleur différente à chacun');

insert into public.members (household_id, first_name, birth_year) values
  ('a1000000-0000-4000-8000-000000000001', 'Neuvième', 2010);

select is(
  (select color::int from public.members where first_name = 'Neuvième'),
  0,
  'Au-delà de huit membres, les couleurs recommencent');

reset role;
select tests.login_as('b0000000-0000-4000-8000-000000000002');

insert into public.members (household_id, first_name, birth_year, color) values
  ('b1000000-0000-4000-8000-000000000002', 'Bob', 1980, 5);

select is(
  (select color::int from public.members where first_name = 'Bob'),
  5,
  'Une couleur choisie à l''ajout est gardée, et chaque foyer a les siennes');

select throws_ok(
  $$insert into public.members (household_id, first_name, birth_year, color)
    values ('b1000000-0000-4000-8000-000000000002', 'Hors palette', 1990, 8)$$,
  '23514', null,
  'Les couleurs vont de 0 à 7');

select * from finish();
rollback;
