-- Catalogue commun (migration 0003) : le compte demandé, des recettes complètes,
-- et des régimes qui tiennent leurs promesses.
-- Lancer : supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

create temp view catalog as
select * from public.recipes where household_id is null;

create temp view catalog_ingredients as
select ri.*, r.diets, r.title
from public.recipe_ingredients ri
join public.recipes r on r.id = ri.recipe_id
where r.household_id is null;

-- ── Le compte ───────────────────────────────────────────────────────────────
select is((select count(*) from catalog), 40::bigint, 'Le catalogue compte 40 recettes');

select is(
  (select count(*) from catalog where id::text like 'ca7a0000-0000-4000-8000-%'),
  40::bigint,
  'Les recettes du catalogue ont des identifiants fixes');

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
select is(
  (select count(*) from catalog c
    where (select count(*) from public.recipe_ingredients ri where ri.recipe_id = c.id) < 2),
  0::bigint,
  'Chaque recette a au moins deux ingrédients');

select is(
  (select count(*) from catalog where cardinality(steps) = 0),
  0::bigint,
  'Chaque recette a ses étapes');

select is(
  (select count(*) from catalog where batch_friendly and coalesce(btrim(batch_notes), '') = ''),
  0::bigint,
  'Chaque recette préparable à l''avance dit ce qu''on fait le dimanche');

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
      and (name in ('Beurre', 'Lait', 'Crème fraîche épaisse', 'Crème liquide', 'Fromage frais')
           or name ilike any (array['%gruyère%', '%emmental%', '%mozzarella%', '%parmesan%',
                                    '%yaourt%', '%feta%', '%comté%', '%fromage blanc%']))),
  null,
  'Aucune recette sans lactose ne contient de produit laitier');

select * from finish();
rollback;
