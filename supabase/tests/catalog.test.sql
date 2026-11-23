-- Catalogue commun (migrations 0003, 0007, 0016, 0018 et 0021) : le compte demandé, des recettes complètes,
-- des basiques qui s'associent, des plats légers d'un ingrédient, et des régimes qui tiennent
-- leurs promesses.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

create temp view catalog as
select * from public.recipes where household_id is null;

create temp view catalog_ingredients as
select ri.*, r.diets, r.title, r.course
from public.recipe_ingredients ri
join public.recipes r on r.id = ri.recipe_id
where r.household_id is null;

-- ── Le compte ───────────────────────────────────────────────────────────────
select is((select count(*) from catalog), 122::bigint, 'Le catalogue compte 122 recettes');

select is(
  (select count(*) from catalog where id::text like 'ca7a0000-0000-4000-8000-%'),
  40::bigint,
  'Les 40 recettes de 0003 ont des identifiants fixes');

-- ── Les basiques (0007, 0018, 0021) ───────────────────────────────────────────────
select is((select count(*) from catalog where basic), 41::bigint, 'Le catalogue compte 41 basiques');

select is(
  (select count(*) from catalog where basic and 'keto' = any (diets)),
  19::bigint,
  'Dont 19 basiques cétogènes');

select is(
  (select count(*) from catalog where basic and base is null),
  0::bigint,
  'Chaque basique a un élément principal');

select results_eq(
  $$select base from catalog where basic group by base
    having bool_or('keto' = any (diets)) and bool_or(not ('keto' = any (diets))) order by base$$,
  $$values ('Côte de porc'), ('Œufs coque'), ('Poulet'), ('Saumon'), ('Steak'), ('Steak haché')$$,
  'Chaque base de basique a une recette céto et une recette pour les autres');

select is(
  (select count(*) from catalog where basic and id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-5'),
  0::bigint,
  'Les basiques ont des identifiants fixes, dérivés du titre');

select cmp_ok(
  (select count(*) from catalog where 'petit_dej' = any (meal_types)), '>=', 10::bigint,
  'Au moins 10 petits-déjeuners');

select cmp_ok(
  (select count(*) from catalog where 'petit_dej' = any (meal_types) and 'keto' = any (diets)),
  '>=', 3::bigint,
  'Au moins 3 petits-déjeuners cétogènes');

select cmp_ok(
  (select count(*) from catalog where 'soir' = any (meal_types)), '>=', 15::bigint,
  'Au moins 15 plats du soir');

select cmp_ok(
  (select count(*) from catalog
    where 'soir' = any (meal_types) and 'keto' = any (diets) and kid_friendly),
  '>=', 6::bigint,
  'Au moins 6 plats du soir cétogènes qui plaisent aussi aux enfants');

select cmp_ok(
  (select count(*) from catalog where 'midi' = any (meal_types) and 'keto' = any (diets)),
  '>=', 8::bigint,
  'Au moins 8 midis cétogènes à emporter');

select cmp_ok(
  (select count(*) from catalog where 'pique_nique' = any (meal_types) and kid_friendly),
  '>=', 6::bigint,
  'Au moins 6 pique-niques rapides pour les enfants');

-- ── Des recettes complètes ──────────────────────────────────────────────────
-- Hors recettes légères (une portion) : un yaourt n'a ni étapes ni second ingrédient.
select is(
  (select count(*) from catalog c
    where c.servings > 1
      and (select count(*) from public.recipe_ingredients ri where ri.recipe_id = c.id) < 2),
  0::bigint,
  'Chaque recette a au moins deux ingrédients');

select is(
  (select count(*) from catalog where servings > 1 and cardinality(steps) = 0),
  0::bigint,
  'Chaque recette a ses étapes');

-- ── Desserts, fruits, fromages (0016) ───────────────────────────────────────
select is(
  (select array_agg(course::text || ':' || n order by course) from (
    select course, count(*) as n from catalog where course <> 'main' group by course) as t),
  array['starter:7', 'dessert:5', 'fruit:10', 'cheese:4', 'dairy:6'],
  '7 entrées, 5 desserts, 10 fruits, 4 fromages, 6 laitages');

select is(
  (select count(*) from catalog c
    where c.course <> 'main' and c.servings = 1 and cardinality(c.steps) = 0
      and (select count(*) from public.recipe_ingredients ri where ri.recipe_id = c.id) = 1),
  21::bigint,
  '21 recettes légères : un ingrédient, une portion, pas d''étapes');

select is(
  (select count(*) from catalog where course <> 'main' and (base is not null or basic)),
  0::bigint,
  'Aucun plat léger n''a d''élément principal ni de place dans « Les basiques »');

-- Chaque ingrédient d'une recette légère est au référentiel commun (identifiant fixe) et se
-- convertit dans son unité d'achat : la liste de courses sait combien en acheter.
select is(
  (select array_agg(ci.title) from catalog_ingredients ci
   left join public.ingredients i on i.id = ci.ingredient_id
   where ci.course <> 'main'
     and ci.recipe_id in (select id from catalog where servings = 1)
     and (i.id is null
          or i.id::text not like '1d9e0000-0000-4000-8000-%'
          or (ci.unit::text <> i.shopping_unit::text
              and not (ci.unit::text in ('g', 'kg') and i.shopping_unit = 'piece' and i.piece_grams is not null)))),
  null,
  'Les recettes légères se convertissent en unités d''achat');

select is(
  (select count(*) from catalog where batch_friendly and coalesce(btrim(batch_notes), '') = ''),
  0::bigint,
  'Chaque recette préparable à l''avance dit ce qu''on fait le dimanche');

-- ── Menu de la semaine du 16 novembre (0017, 0018) ──────────────────────────
select is(
  (select count(*) from public.ingredients where name_key = private.ingredient_key('Reblochon')),
  1::bigint,
  'Le Reblochon existe une seule fois au référentiel');

select is(
  (select base from catalog where id = 'ca7a0000-0000-4000-8000-000000000016'),
  'Quiche lorraine',
  'La quiche lorraine du catalogue a sa base');

-- Chaque plat du lot a un double de même base : l'un céto, l'autre pas.
select results_eq(
  $$select base from catalog
    where base in ('Œufs coque', 'Reblochon', 'Sauce bolognaise', 'Quiche lorraine')
    group by base
    having bool_or('keto' = any (diets)) and bool_or(not ('keto' = any (diets)))
    order by base$$,
  $$values ('Œufs coque'), ('Quiche lorraine'), ('Reblochon'), ('Sauce bolognaise')$$,
  'Œufs coque, tartiflette, bolognaise et quiche ont chacune leur double céto');

-- ── Menu de la semaine du 23 novembre (0020, 0021) ──────────────────────────
select results_eq(
  $$select name, count(*) from public.ingredients
    where name_key in (private.ingredient_key('Navets'), private.ingredient_key('Fenouils'),
                       private.ingredient_key('Macédoine de légumes'), private.ingredient_key('Tapenade'))
    group by name
    order by name$$,
  $$values ('Fenouils', 1::bigint), ('Macédoine de légumes', 1::bigint), ('Navets', 1::bigint),
           ('Tapenade', 1::bigint)$$,
  'Navets, fenouils, macédoine et tapenade existent une seule fois au référentiel');

select is(
  (select piece_grams from public.ingredients
    where household_id is null and name_key = private.ingredient_key('Petits pois surgelés')),
  1000::numeric,
  'Les petits pois surgelés s''achètent en sachet d''1 kg');

-- ── Des régimes tenus ───────────────────────────────────────────────────────
select is(
  (select array_agg(distinct title || ' : ' || name) from catalog_ingredients
    where 'keto' = any (diets)
      and (name in ('Farine', 'Sucre', 'Lait', 'Miel', 'Confiture')
           or name ilike any (array['%pâtes%', '%riz%', '%pommes de terre%', '%pain%',
                                    '%banane%', '%flocons d''avoine%', '%tortilla%', '%maïs%']))),
  null,
  'Aucune recette cétogène ne contient de farine, de sucre, de féculents ni de pain');

select is(
  (select array_agg(distinct title || ' : ' || name) from catalog_ingredients
    where 'vegetarian' = any (diets)
      and name ilike any (array['%jambon%', '%lardons%', '%poulet%', '%bœuf%', '%veau%',
                                '%porc%', '%dinde%', '%bacon%', '%saucisse%', '%chorizo%',
                                '%saumon%', '%thon%', '%cabillaud%', '%crevettes%', '%anchois%'])),
  null,
  'Aucune recette végétarienne ne contient de viande ni de poisson');

select is(
  (select array_agg(distinct title || ' : ' || name) from catalog_ingredients
    where 'gluten_free' = any (diets)
      and (name in ('Farine', 'Chapelure')
           or name ilike any (array['%pâtes%', '%pain%', '%tortilla%', '%flocons d''avoine%',
                                    '%gressins%', '%lasagne%', '%semoule%']))),
  null,
  'Aucune recette sans gluten ne contient de blé');

select is(
  (select array_agg(distinct title || ' : ' || name) from catalog_ingredients
    where 'lactose_free' = any (diets)
      -- Sauf les fromages affinés, quasiment sans lactose (note de recettes-legeres.json).
      and not (course = 'cheese' and name in ('Comté', 'Emmental'))
      and (name in ('Beurre', 'Lait', 'Crème fraîche épaisse', 'Crème liquide', 'Fromage frais')
           or name ilike any (array['%gruyère%', '%emmental%', '%mozzarella%', '%parmesan%',
                                    '%yaourt%', '%feta%', '%comté%', '%fromage blanc%']))),
  null,
  'Aucune recette sans lactose ne contient de produit laitier');


select * from finish();
rollback;
