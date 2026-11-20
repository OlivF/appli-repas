-- Catalogue commun : 28 recettes importées de recettes-legeres.json.
-- Fichier généré, ne pas modifier à la main. Pour le régénérer :
--   docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/json-to-catalogue.ts recettes-legeres.json supabase/migrations/0016_light_catalog.sql
-- Identifiants fixes dérivés du titre, « on conflict do nothing » : rejouable sans doublon.

-- Yaourt nature
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '81b4fa64-ed99-5fdd-be5f-0d22917ce714', null, 'Yaourt nature', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'dairy'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Yaourts nature', 1::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Yaourt grec nature
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '62c91ed5-6d4d-5bc9-95b5-501efceb0546', null, 'Yaourt grec nature', 'Au lait entier, sans sucre : il passe en cétogène.',
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'keto']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'dairy'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Yaourt à la grecque', 100::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Yaourt aux fruits
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'd01f9ca3-1fbe-5158-8756-f9c2fb91f53f', null, 'Yaourt aux fruits', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'dairy'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Yaourts aux fruits', 1::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Fromage blanc
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '4aa9d0ad-ec0f-506f-b1dc-24335d80bb97', null, 'Fromage blanc', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'dairy'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Fromage blanc', 100::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Petits-suisses
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'b2c6e1b9-8afb-5f92-af7d-d050a31ae8bd', null, 'Petits-suisses', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'dairy'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Petits-suisses', 2::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Crème dessert
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '357be026-ce6e-57fc-8ca7-5e009abb81d7', null, 'Crème dessert', null,
    array['midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'dairy'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Crèmes dessert', 1::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Pomme
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '83573e55-5847-5371-b2a2-d7ff145de6e6', null, 'Pomme', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pommes', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poire
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '1c090dd2-0481-5853-be3a-665084a8ea53', null, 'Poire', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Poires', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Banane
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '7c48466a-20ec-59bc-80a6-3bc1ad9d7905', null, 'Banane', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Bananes', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Clémentines
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '58281a5a-b936-5a14-bae8-d792e87c2a88', null, 'Clémentines', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Clémentines', 2::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Orange
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '405e4f2f-2f47-5099-bd09-e23011921eb9', null, 'Orange', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Oranges', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Kiwi
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'd861042b-b60f-5c14-92c2-97a8a23c5f42', null, 'Kiwi', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Kiwis', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Raisin
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'c156bf33-07a4-5fa2-8a15-7f16d1c72cda', null, 'Raisin', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Raisin', 125::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Fraises
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '40c23516-bdc7-5f45-bd18-ee1faff5e376', null, 'Fraises', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Fraises', 125::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Framboises
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'd23b7a5b-8565-5706-8919-08c155333e4e', null, 'Framboises', 'Une petite poignée : le fruit qui passe en cétogène.',
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free', 'keto']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Framboises', 60::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Compote en gourde
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'd21ad493-b028-52cb-acbb-8f96b11a8086', null, 'Compote en gourde', null,
    array['petit_dej', 'midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'fruit'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Compotes en gourde', 1::numeric, 'piece'::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Comté
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'd32895da-1bf7-53d4-bebe-4e567c3e2a16', null, 'Comté', 'Fromage affiné : quasiment sans lactose.',
    array['midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free', 'keto']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'cheese'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Comté', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Emmental
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '98b5a501-d344-5a2d-8504-067f4bc0c0ef', null, 'Emmental', 'Fromage affiné : quasiment sans lactose.',
    array['midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'lactose_free', 'keto']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'cheese'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Emmental', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Camembert
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '2b74ccf7-dd2c-5dbf-8789-d99d7a5da173', null, 'Camembert', null,
    array['midi', 'soir']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'keto']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'cheese'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Camembert', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Chèvre
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '5503c665-0d35-55d5-aa71-e38c8eb4ae57', null, 'Chèvre', null,
    array['midi', 'soir']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'keto']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'cheese'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Fromage de chèvre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Carré de chocolat noir
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'c05f6e30-64d3-5617-9dbb-23503a6c1f4d', null, 'Carré de chocolat noir', 'Un carré à 85 % ou plus : ça passe en cétogène.',
    array['midi', 'soir', 'pique_nique']::public.meal_type[], 1, 0, 0,
    array['vegetarian', 'gluten_free', 'keto']::public.diet[],
    array[]::text[],
    false, null, true, null, false,
    'dessert'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Chocolat noir', 10::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Framboises à la chantilly
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '9e8b1639-3290-5dda-b631-7ee8887daa26', null, 'Framboises à la chantilly', 'Le dessert cétogène qui plaît aussi aux enfants.',
    array['midi', 'soir']::public.meal_type[], 4, 10, 0,
    array['vegetarian', 'gluten_free', 'keto']::public.diet[],
    array['Fouette la crème bien froide en chantilly, sans sucre (ou avec un peu d''édulcorant pour Marie-Laure).', 'Sers les framboises avec une cuillère de chantilly.']::text[],
    false, null, true, null, false,
    'dessert'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Framboises', 250::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Crème liquide', 200::numeric, 'ml'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Salade de fruits
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '604f3b2a-93cd-50ba-9ec5-5107e13b6bb4', null, 'Salade de fruits', null,
    array['midi', 'soir']::public.meal_type[], 4, 15, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array['Pèle les oranges à vif et coupe-les en morceaux au-dessus d''un saladier pour garder le jus.', 'Coupe les pommes, les bananes et les kiwis en dés, mélange avec les oranges.', 'Garde au frais jusqu''au repas.']::text[],
    false, null, true, null, false,
    'dessert'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pommes', 2::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Bananes', 2::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (2::smallint, 'Oranges', 2::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Kiwis', 2::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Mousse au chocolat
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'e11e7c08-61b4-56c3-be3d-6594f92e1aea', null, 'Mousse au chocolat', null,
    array['midi', 'soir']::public.meal_type[], 6, 20, 0,
    array['vegetarian', 'gluten_free']::public.diet[],
    array['Fais fondre le chocolat au bain-marie ou au micro-ondes par petites touches.', 'Sépare les blancs des jaunes ; mélange les jaunes au chocolat tiède.', 'Monte les blancs en neige ferme avec une pincée de sel, puis incorpore-les délicatement en trois fois.', 'Au frais au moins 3 heures.']::text[],
    true, 'Se prépare le dimanche, se garde 2 jours au frigo.', true, null, false,
    'dessert'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Chocolat noir', 200::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (1::smallint, 'Œufs', 6::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (2::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Gâteau au yaourt
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '6256a58f-ce4c-5869-a2ee-94bfa9f3545b', null, 'Gâteau au yaourt', null,
    array['midi', 'soir', 'pique_nique', 'petit_dej']::public.meal_type[], 8, 10, 35,
    array['vegetarian']::public.diet[],
    array['Préchauffe le four à 180 °C et beurre un moule.', 'Verse le yaourt dans un saladier, puis ajoute dans l''ordre le sucre, les œufs, la farine, la levure et l''huile en mélangeant entre chaque.', 'Verse dans le moule et fais cuire 35 minutes : la lame d''un couteau doit ressortir sèche.']::text[],
    true, 'Se fait le dimanche, tient 4 jours sous cloche : goûters et desserts de la semaine.', true, null, false,
    'dessert'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Yaourts nature', 1::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (1::smallint, 'Farine', 250::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Sucre', 150::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Œufs', 3::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Huile de tournesol', 80::numeric, 'ml'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Levure chimique', 11::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Carottes râpées
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '6ec9451e-dfb8-5fca-96c9-77a06f7ed9b7', null, 'Carottes râpées', null,
    array['midi', 'soir', 'pique_nique']::public.meal_type[], 4, 10, 0,
    array['vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array['Râpe les carottes.', 'Arrose de jus de citron et d''huile d''olive, sale, poivre, mélange.']::text[],
    false, null, true, null, false,
    'starter'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Carottes', 400::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Citrons', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (2::smallint, 'Huile d''olive', 2::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Avocat vinaigrette
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '79d35f42-6146-5bd4-afd8-bbc9a0c937cd', null, 'Avocat vinaigrette', null,
    array['midi', 'soir']::public.meal_type[], 2, 5, 0,
    array['vegetarian', 'gluten_free', 'lactose_free', 'keto']::public.diet[],
    array['Coupe l''avocat en deux et retire le noyau.', 'Mélange moutarde, vinaigre et huile, sale, poivre, verse dans le creux.']::text[],
    false, null, true, null, false,
    'starter'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Avocats', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Vinaigre de cidre', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Moutarde', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Concombre à la crème
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '7ce3060f-aee5-564d-b138-8edaadfdca1d', null, 'Concombre à la crème', null,
    array['midi', 'soir']::public.meal_type[], 4, 10, 0,
    array['vegetarian', 'gluten_free', 'keto']::public.diet[],
    array['Coupe le concombre en fines rondelles.', 'Mélange avec la crème, la ciboulette ciselée, sel et poivre.']::text[],
    false, null, true, null, false,
    'starter'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Concombres', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Crème fraîche épaisse', 100::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (2::smallint, 'Ciboulette', null::numeric, null::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);
