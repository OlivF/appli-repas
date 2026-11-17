-- Recettes : le catalogue est lisible par tous et modifiable par personne ;
-- recettes, ingrédients, favoris et membres exclus restent dans leur foyer.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(38);

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

-- Identifiants créés pendant les tests (recettes enregistrées, copies).
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

insert into public.members (id, household_id, first_name, birth_year) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Alice', 1985),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Arthur', 2018),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Bob', 1980);

-- Une recette du catalogue (household_id null) et une recette de Bob.
insert into public.recipes (id, household_id, title, meal_types, servings) values
  ('cc000000-0000-4000-8000-000000000001', null, 'Omelette du catalogue', '{soir}', 4),
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Recette de Bob', '{midi}', 2);

insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle) values
  ('cc000000-0000-4000-8000-000000000001', 0, 'Œufs', 6, 'piece', 'cremerie'),
  ('cc000000-0000-4000-8000-000000000001', 1, 'Lait', 100, 'ml', 'cremerie'),
  ('b3000000-0000-4000-8000-000000000001', 0, 'Ingrédient secret de Bob', 1, 'piece', 'epicerie');

insert into public.recipe_favorites (household_id, recipe_id) values
  ('b1000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001');

insert into public.recipe_member_exclusions (household_id, recipe_id, member_id) values
  ('b1000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001',
   'b2000000-0000-4000-8000-000000000001');

-- ── Alice : le catalogue se lit, ne se modifie pas ──────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

select results_eq(
  $$select title from public.recipes where id = 'cc000000-0000-4000-8000-000000000001'$$,
  $$values ('Omelette du catalogue')$$,
  'Alice lit une recette du catalogue');

select is(
  (select count(*) from public.recipe_ingredients
    where recipe_id = 'cc000000-0000-4000-8000-000000000001'),
  2::bigint,
  'Alice lit les ingrédients d''une recette du catalogue');

select is(
  tests.rows_affected($$update public.recipes set title = 'Piratée'
    where id = 'cc000000-0000-4000-8000-000000000001'$$),
  0::bigint,
  'Alice ne peut pas modifier une recette du catalogue');

select is(
  tests.rows_affected($$delete from public.recipes
    where id = 'cc000000-0000-4000-8000-000000000001'$$),
  0::bigint,
  'Alice ne peut pas supprimer une recette du catalogue');

select is(
  tests.rows_affected($$update public.recipe_ingredients set quantity = 99
    where recipe_id = 'cc000000-0000-4000-8000-000000000001'$$),
  0::bigint,
  'Alice ne peut pas modifier les ingrédients du catalogue');

select throws_ok(
  $$insert into public.recipe_ingredients (recipe_id, name)
    values ('cc000000-0000-4000-8000-000000000001', 'Sel')$$,
  '42501', null,
  'Alice ne peut pas ajouter d''ingrédient à une recette du catalogue');

select throws_ok(
  $$insert into public.recipes (household_id, title, meal_types, servings)
    values (null, 'Ma recette au catalogue', '{soir}', 4)$$,
  '42501', null,
  'Alice ne peut pas ajouter de recette au catalogue');

-- ── Alice : rien de ce qui est à Bob ────────────────────────────────────────
select is(
  tests.visible_rows($$select id from public.recipes
    where household_id = 'b1000000-0000-4000-8000-000000000002'$$)
    + tests.visible_rows($$select id from public.recipe_ingredients
      where recipe_id = 'b3000000-0000-4000-8000-000000000001'$$)
    + tests.visible_rows('select recipe_id from public.recipe_favorites')
    + tests.visible_rows('select recipe_id from public.recipe_member_exclusions'),
  0::bigint,
  'Alice ne voit ni les recettes, ni les ingrédients, ni les favoris, ni les exclus de Bob');

select throws_ok(
  $$insert into public.recipes (household_id, title, meal_types, servings)
    values ('b1000000-0000-4000-8000-000000000002', 'Intruse', '{soir}', 4)$$,
  '42501', null,
  'Alice ne peut pas créer de recette chez Bob');

select throws_ok(
  $$select public.save_recipe('b1000000-0000-4000-8000-000000000002',
    '{"title": "Intruse", "meal_types": ["soir"], "servings": 4}', '[]', '{}')$$,
  '42501', null,
  'Alice ne peut pas créer de recette chez Bob par save_recipe');

select throws_ok(
  $$select public.save_recipe('a1000000-0000-4000-8000-000000000001',
    '{"title": "Piratée", "meal_types": ["soir"], "servings": 4}', '[]', '{}',
    'b3000000-0000-4000-8000-000000000001')$$,
  'P0002', null,
  'Alice ne peut pas réécrire la recette de Bob par save_recipe');

select throws_ok(
  $$insert into public.recipe_favorites (household_id, recipe_id)
    values ('a1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001')$$,
  '23503', null,
  'Alice ne peut pas mettre en favori une recette de Bob');

select throws_ok(
  $$insert into public.recipe_member_exclusions (household_id, recipe_id, member_id)
    values ('a1000000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000001',
            'b2000000-0000-4000-8000-000000000001')$$,
  '23503', null,
  'Alice ne peut pas exclure un membre de Bob');

-- ── Alice : enregistrer une recette ─────────────────────────────────────────
insert into tests.ids
select 'alice', public.save_recipe(
  'a1000000-0000-4000-8000-000000000001',
  '{"title": "Crêpes", "description": "Pour le goûter", "meal_types": ["petit_dej", "soir"],
    "servings": 4, "prep_minutes": 10, "cook_minutes": 20, "diets": ["vegetarian"],
    "steps": ["Mélanger", "Cuire"], "batch_friendly": true, "batch_notes": "Pâte la veille",
    "kid_friendly": true}',
  '[{"name": "Farine", "quantity": 250, "unit": "g", "aisle": "epicerie"},
    {"name": "Œufs", "quantity": 3, "unit": "piece", "aisle": "cremerie"},
    {"name": "Sel", "quantity": null, "unit": null, "aisle": null}]',
  array['a2000000-0000-4000-8000-000000000002']::uuid[]);

select results_eq(
  $$select title, meal_types::text[], servings::int, diets::text[], steps, batch_friendly, kid_friendly
    from public.recipes where id = (select id from tests.ids where name = 'alice')$$,
  $$values ('Crêpes', array['petit_dej', 'soir'], 4, array['vegetarian'],
            array['Mélanger', 'Cuire'], true, true)$$,
  'save_recipe crée la recette avec ses champs');

select results_eq(
  $$select name, quantity, unit::text, aisle::text from public.recipe_ingredients
    where recipe_id = (select id from tests.ids where name = 'alice') order by position$$,
  $$values ('Farine', 250::numeric, 'g', 'epicerie'), ('Œufs', 3::numeric, 'piece', 'cremerie'),
           ('Sel', null::numeric, null, 'autre')$$,
  'save_recipe enregistre les ingrédients dans l''ordre, au rayon « autre » par défaut');

select is(
  (select count(*) from public.recipe_ingredients
    where recipe_id = (select id from tests.ids where name = 'alice')
      and household_id = 'a1000000-0000-4000-8000-000000000001'),
  3::bigint,
  'Les ingrédients portent le foyer de leur recette');

select results_eq(
  $$select member_id from public.recipe_member_exclusions
    where recipe_id = (select id from tests.ids where name = 'alice')$$,
  $$values ('a2000000-0000-4000-8000-000000000002'::uuid)$$,
  'save_recipe enregistre les membres exclus');

select is(
  public.save_recipe(
    'a1000000-0000-4000-8000-000000000001',
    '{"title": "Crêpes fines", "meal_types": ["petit_dej"], "servings": 6}',
    '[{"name": "Farine", "quantity": 300, "unit": "g", "aisle": "epicerie"}]',
    '{}',
    (select id from tests.ids where name = 'alice')),
  (select id from tests.ids where name = 'alice'),
  'Une nouvelle sauvegarde garde le même identifiant');

select results_eq(
  $$select r.title, r.servings::int, count(ri.id)
    from public.recipes r join public.recipe_ingredients ri on ri.recipe_id = r.id
    where r.id = (select id from tests.ids where name = 'alice') group by r.id$$,
  $$values ('Crêpes fines', 6, 1::bigint)$$,
  'Une nouvelle sauvegarde remplace la recette et ses ingrédients');

select is(
  (select count(*) from public.recipe_member_exclusions
    where recipe_id = (select id from tests.ids where name = 'alice')),
  0::bigint,
  'Une nouvelle sauvegarde remplace les membres exclus');

select throws_ok(
  $$select public.save_recipe('a1000000-0000-4000-8000-000000000001',
    '{"title": "Sans repas", "meal_types": [], "servings": 4}', '[]', '{}')$$,
  '23514', null,
  'Une recette sans type de repas est refusée');

select throws_ok(
  $$select public.save_recipe('a1000000-0000-4000-8000-000000000001',
    '{"title": "Bancale", "meal_types": ["soir"], "servings": 4}',
    '[{"name": "Farine", "quantity": 250, "unit": null}]', '{}')$$,
  '23514', null,
  'Une quantité sans unité est refusée');

select is(
  (select count(*) from public.recipes where household_id = 'a1000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Une sauvegarde refusée ne laisse rien derrière elle');

-- ── Alice : favori et exclus sur le catalogue, puis copie ──────────────────
select lives_ok(
  $$insert into public.recipe_favorites (household_id, recipe_id)
    values ('a1000000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000001')$$,
  'Alice met une recette du catalogue en favori');

select lives_ok(
  $$insert into public.recipe_member_exclusions (household_id, recipe_id, member_id)
    values ('a1000000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000001',
            'a2000000-0000-4000-8000-000000000002')$$,
  'Alice note qu''Arthur ne mange pas une recette du catalogue');

insert into tests.ids
select 'copy', public.copy_recipe('cc000000-0000-4000-8000-000000000001',
                                  'a1000000-0000-4000-8000-000000000001');

select results_eq(
  $$select household_id, source_recipe_id, title from public.recipes
    where id = (select id from tests.ids where name = 'copy')$$,
  $$values ('a1000000-0000-4000-8000-000000000001'::uuid,
            'cc000000-0000-4000-8000-000000000001'::uuid, 'Omelette du catalogue')$$,
  'copy_recipe crée une recette du foyer liée à l''originale');

select results_eq(
  $$select name from public.recipe_ingredients
    where recipe_id = (select id from tests.ids where name = 'copy') order by position$$,
  $$values ('Œufs'), ('Lait')$$,
  'copy_recipe copie les ingrédients');

select results_eq(
  $$select (select count(*) from public.recipe_favorites
              where recipe_id = (select id from tests.ids where name = 'copy')),
           (select count(*) from public.recipe_favorites
              where recipe_id = 'cc000000-0000-4000-8000-000000000001')$$,
  $$values (1::bigint, 0::bigint)$$,
  'Le favori passe de l''originale à la copie');

select results_eq(
  $$select (select count(*) from public.recipe_member_exclusions
              where recipe_id = (select id from tests.ids where name = 'copy')),
           (select count(*) from public.recipe_member_exclusions
              where recipe_id = 'cc000000-0000-4000-8000-000000000001')$$,
  $$values (1::bigint, 0::bigint)$$,
  'Les membres exclus passent de l''originale à la copie');

select is(
  public.copy_recipe('cc000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  (select id from tests.ids where name = 'copy'),
  'Copier une deuxième fois rend la copie existante');

select throws_ok(
  $$select public.copy_recipe('b3000000-0000-4000-8000-000000000001',
                              'a1000000-0000-4000-8000-000000000001')$$,
  'P0002', null,
  'Alice ne peut pas copier une recette de Bob');

select ok(
  exists (select 1 from public.known_ingredients where name = 'Lait')
    and exists (select 1 from public.known_ingredients where name = 'Farine')
    and not exists (select 1 from public.known_ingredients where name = 'Ingrédient secret de Bob'),
  'Les ingrédients connus d''Alice : le catalogue et les siens, pas ceux de Bob');

select results_eq(
  $$select aisle::text, unit::text from public.known_ingredients where name = 'Farine'$$,
  $$values ('epicerie', 'g')$$,
  'Un ingrédient connu vient avec son rayon et son unité');

select is(
  tests.rows_affected($$delete from public.recipes
    where id = (select id from tests.ids where name = 'copy')$$),
  1::bigint,
  'Alice peut supprimer sa recette');

-- ── Bob : ne voit pas ce qu'Alice a fait du catalogue ───────────────────────
reset role;
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select results_eq(
  'select recipe_id from public.recipe_favorites',
  $$values ('b3000000-0000-4000-8000-000000000001'::uuid)$$,
  'Bob ne voit que ses favoris');

select is(
  (select count(*) from public.recipes where household_id = 'a1000000-0000-4000-8000-000000000001'),
  0::bigint,
  'Bob ne voit pas les recettes d''Alice');

-- ── Visiteur non connecté ───────────────────────────────────────────────────
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(
  tests.visible_rows('select id from public.recipes')
    + tests.visible_rows('select id from public.recipe_ingredients')
    + tests.visible_rows('select name from public.known_ingredients'),
  0::bigint,
  'Un visiteur non connecté ne lit aucune recette, même du catalogue');

select throws_ok(
  $$select public.copy_recipe('cc000000-0000-4000-8000-000000000001',
                              'a1000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'Un visiteur non connecté ne peut pas copier de recette');

select * from finish();
rollback;
