-- Référentiel d'ingrédients (migration 0009) : commun lisible par tous et intouchable,
-- ingrédients propres au foyer, rattachement des lignes de recette par nom ou alias normalisés.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

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

-- ── Normalisation ───────────────────────────────────────────────────────────
select is(private.ingredient_key('  Œufs '), 'oeuf', 'Œufs → oeuf (casse, ligature, espaces, pluriel)');
select is(private.ingredient_key('Pommes de terre'), 'pomme de terre', 'Chaque mot perd son pluriel');
select is(private.ingredient_key('Riz'), 'riz', 'Un mot de trois lettres garde son s ou son x');
select is(private.ingredient_key('Gousses d’ail'), private.ingredient_key('gousse d''ail'),
  'Apostrophe typographique et pluriel ignorés');
select is(private.ingredient_key('Choux-fleurs'), private.ingredient_key('Chou fleur'),
  'Trait d''union et pluriel en x ignorés');

-- ── Référentiel commun livré par la migration ───────────────────────────────
select is(
  (select count(*) from public.recipe_ingredients where ingredient_id is null),
  0::bigint,
  'Toutes les lignes de recette existantes sont rattachées');

select results_eq(
  $$select distinct i.name from public.recipe_ingredients ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.household_id is null and ri.name in ('Laitue', 'Salade verte')$$,
  $$values ('Salades vertes')$$,
  'Laitue et salade verte : un seul ingrédient, « Salades vertes »');

select results_eq(
  $$select name, grams_per_ml from public.ingredients
    where household_id is null and name in ('Crème fraîche épaisse', 'Graines de chia') order by name$$,
  $$values ('Crème fraîche épaisse', 1.000::numeric(5, 3)), ('Graines de chia', 0.800::numeric(5, 3))$$,
  'Densités utiles aux conversions du catalogue');

select is(
  (select count(*) from public.ingredients
    where household_id is null and pantry and name in ('Sel', 'Poivre', 'Huile d''olive')),
  3::bigint,
  'Sel, poivre et huile d''olive sont au placard');

select cmp_ok(
  (select count(*) from public.ingredients where household_id is null),
  '>=', 160::bigint,
  'Le commun couvre le catalogue et les produits courants du drive');

select is(
  (select aisle::text from public.ingredients where household_id is null and name = 'Papier toilette'),
  'autre',
  'Un produit courant hors cuisine est au rayon « autre »');

-- ── Jeu de données, créé en superutilisateur (la RLS ne s'applique pas) ─────
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@example.com'),
  ('b0000000-0000-4000-8000-000000000002', 'bob@example.com');

insert into public.households (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'Foyer Alice'),
  ('b1000000-0000-4000-8000-000000000002', 'Foyer Bob');

insert into public.household_users (household_id, user_id) values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');

-- Des noms inventés, pour ne pas croiser le référentiel commun livré par la migration.
insert into public.ingredients (id, household_id, name, aisle, shopping_unit, aliases) values
  ('1e000000-0000-4000-8000-000000000001', null, 'Grenouilles bleues', 'epicerie', 'piece', '{"Batraciens Bleus"}'),
  ('1e000000-0000-4000-8000-000000000002', null, 'Pétoncles du jardin', 'fruits_legumes', 'g', '{}'),
  ('1e000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Pétoncles du jardin', 'poissonnerie', 'g', '{}'),
  ('1e000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000002', 'Secret de Bob', 'autre', 'piece', '{}');

select is(
  (select aliases from public.ingredients where id = '1e000000-0000-4000-8000-000000000001'),
  '{"batracien bleu"}'::text[],
  'Les alias sont enregistrés normalisés');

-- Une recette du catalogue dont la ligne pointe (à dessein) vers un autre ingrédient que son nom :
-- la copie doit recopier ce lien, pas le rechercher.
insert into public.recipes (id, household_id, title, meal_types, servings) values
  ('cc000000-0000-4000-8000-000000000001', null, 'Grenouilles du catalogue', '{soir}', 4);
insert into public.recipe_ingredients (id, recipe_id, position, name, quantity, unit, aisle) values
  ('cd000000-0000-4000-8000-000000000001', 'cc000000-0000-4000-8000-000000000001', 0,
   'Grenouilles bleues', 2, 'piece', 'epicerie');

select is(
  (select ingredient_id from public.recipe_ingredients where id = 'cd000000-0000-4000-8000-000000000001'),
  '1e000000-0000-4000-8000-000000000001'::uuid,
  'Une ligne du catalogue est rattachée au commun');

update public.recipe_ingredients
set ingredient_id = '1e000000-0000-4000-8000-000000000002'
where id = 'cd000000-0000-4000-8000-000000000001';

-- ── Alice : lecture ─────────────────────────────────────────────────────────
select tests.login_as('a0000000-0000-4000-8000-000000000001');

select is(
  tests.visible_rows($$select id from public.ingredients where id in (
    '1e000000-0000-4000-8000-000000000001', '1e000000-0000-4000-8000-000000000002',
    '1e000000-0000-4000-8000-000000000003')$$),
  3::bigint,
  'Alice lit le commun et les ingrédients de son foyer');

select is(
  tests.visible_rows($$select id from public.ingredients
    where household_id = 'b1000000-0000-4000-8000-000000000002'$$),
  0::bigint,
  'Alice ne voit aucun ingrédient du foyer de Bob');

-- ── Alice : le commun est intouchable ───────────────────────────────────────
select throws_ok(
  $$insert into public.ingredients (household_id, name, aisle, shopping_unit)
    values (null, 'Ingrédient pirate', 'autre', 'piece')$$,
  '42501', null,
  'Alice ne peut pas ajouter d''ingrédient au commun');

select is(
  tests.rows_affected($$update public.ingredients set name = 'Pirate'
    where id = '1e000000-0000-4000-8000-000000000001'$$),
  0::bigint,
  'Alice ne peut pas modifier un ingrédient commun');

select is(
  tests.rows_affected($$delete from public.ingredients
    where id = '1e000000-0000-4000-8000-000000000001'$$),
  0::bigint,
  'Alice ne peut pas supprimer un ingrédient commun');

select lives_ok(
  $$insert into public.ingredients (household_id, name, aisle, shopping_unit)
    values ('a1000000-0000-4000-8000-000000000001', 'Confiture de mamie', 'epicerie', 'g')$$,
  'Alice ajoute un ingrédient à son foyer');

-- ── match_ingredient ────────────────────────────────────────────────────────
select is(
  private.match_ingredient('a1000000-0000-4000-8000-000000000001', 'grenouille bleue', 'autre', null),
  '1e000000-0000-4000-8000-000000000001'::uuid,
  'Trouvé par son nom, au singulier et sans majuscule');

select is(
  private.match_ingredient('a1000000-0000-4000-8000-000000000001', 'Batracien bleu', 'autre', null),
  '1e000000-0000-4000-8000-000000000001'::uuid,
  'Trouvé par un alias');

select is(
  private.match_ingredient('a1000000-0000-4000-8000-000000000001', 'PETONCLE DU JARDIN', 'autre', 'g'),
  '1e000000-0000-4000-8000-000000000003'::uuid,
  'Sans accents ; l''ingrédient du foyer passe avant le commun');

insert into tests.ids
select 'topinambours', private.match_ingredient(
  'a1000000-0000-4000-8000-000000000001', '  Topinambours   rôtis ', 'fruits_legumes', 'cas');

select results_eq(
  $$select household_id, name, aisle::text, shopping_unit::text from public.ingredients
    where id = (select id from tests.ids where name = 'topinambours')$$,
  $$values ('a1000000-0000-4000-8000-000000000001'::uuid, 'Topinambours rôtis', 'fruits_legumes', 'ml')$$,
  'Inconnu : créé dans le foyer, avec ce rayon ; une cuillère s''achète en ml');

insert into tests.ids values
  ('chataigne', private.match_ingredient('a1000000-0000-4000-8000-000000000001', 'Farine de châtaigne', 'epicerie', 'kg')),
  ('fleur de sel', private.match_ingredient('a1000000-0000-4000-8000-000000000001', 'Fleur de sel de Guérande', 'epicerie', null));

select is(
  (select shopping_unit::text from public.ingredients where id = (select id from tests.ids where name = 'chataigne')),
  'g',
  'Créé depuis des kg : s''achète en g');

select is(
  (select shopping_unit::text from public.ingredients where id = (select id from tests.ids where name = 'fleur de sel')),
  'piece',
  'Créé sans unité : s''achète à la pièce');

select throws_ok(
  $$select private.match_ingredient(null, 'Ingrédient pirate', 'autre', 'g')$$,
  '42501', null,
  'Alice ne peut pas créer d''ingrédient commun par match_ingredient');

-- ── Lignes de recette ───────────────────────────────────────────────────────
insert into public.recipes (id, household_id, title, meal_types, servings) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Recette d''Alice', '{soir}', 4);
insert into public.recipe_ingredients (id, recipe_id, position, name, quantity, unit, aisle) values
  ('ad000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 0,
   'Batraciens bleus', 2, 'cas', 'autre');

select is(
  (select ingredient_id from public.recipe_ingredients where id = 'ad000000-0000-4000-8000-000000000001'),
  '1e000000-0000-4000-8000-000000000001'::uuid,
  'Une ligne ajoutée par Alice est rattachée au référentiel');

update public.recipe_ingredients set name = 'Pétoncles du jardin'
where id = 'ad000000-0000-4000-8000-000000000001';

select is(
  (select ingredient_id from public.recipe_ingredients where id = 'ad000000-0000-4000-8000-000000000001'),
  '1e000000-0000-4000-8000-000000000003'::uuid,
  'Une ligne renommée est rattachée à nouveau');

update public.recipe_ingredients set name = 'Grenouilles bleues'
where id = 'ad000000-0000-4000-8000-000000000001';

insert into tests.ids
select 'copie', public.copy_recipe('cc000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001');

select is(
  (select ri.ingredient_id from public.recipe_ingredients ri
    where ri.recipe_id = (select id from tests.ids where name = 'copie')),
  '1e000000-0000-4000-8000-000000000002'::uuid,
  'copy_recipe recopie l''ingrédient de l''original');

-- ── known_ingredients (autocomplétion) ──────────────────────────────────────
select results_eq(
  $$select aisle::text from public.known_ingredients where name = 'Pétoncles du jardin'$$,
  $$values ('poissonnerie')$$,
  'Un ingrédient du foyer remplace le commun de même nom');

select is(
  (select unit::text from public.known_ingredients where name = 'Grenouilles bleues'),
  'cas',
  'Unité proposée : la plus utilisée dans les recettes');

select is(
  (select unit::text from public.known_ingredients where name = 'Topinambours rôtis'),
  'ml',
  'Sans recette : l''unité d''achat');

select is(
  tests.visible_rows($$select name from public.known_ingredients where name = 'Secret de Bob'$$),
  0::bigint,
  'L''autocomplétion d''Alice ne propose rien du foyer de Bob');

select * from finish();
rollback;
