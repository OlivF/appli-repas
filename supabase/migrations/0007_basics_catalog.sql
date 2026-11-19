-- Catalogue commun : 35 recettes importées de recettes-basiques.json.
-- Fichier généré, ne pas modifier à la main. Pour le régénérer :
--   docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/json-to-catalogue.ts recettes-basiques.json supabase/migrations/0007_basics_catalog.sql
-- Identifiants fixes dérivés du titre, « on conflict do nothing » : rejouable sans doublon.

-- Steak haché et frites
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '8b23b112-6384-5821-9a26-0c3978cb0ac3', null, 'Steak haché et frites', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 25,
    array['lactose_free']::public.diet[],
    array['Étale les frites sur une plaque et enfourne-les à 220 °C pour 20 à 25 minutes, en les retournant à mi-cuisson.', 'Sors les steaks hachés du frigo 10 minutes avant.', 'Fais chauffer l''huile dans une poêle à feu vif et cuis les steaks 2 à 3 minutes de chaque côté. Sale et poivre en fin de cuisson.']::text[],
    false, null, true, 'Steak haché', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Frites surgelées au four', 800::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché et polenta
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'c78779b4-5961-5d72-8d21-37b69e3cfdb9', null, 'Steak haché et polenta', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 6,
    array['gluten_free']::public.diet[],
    array['Sors les steaks hachés du frigo 10 minutes avant.', 'Fais chauffer l''huile dans une poêle à feu vif et cuis les steaks 2 à 3 minutes de chaque côté. Sale et poivre en fin de cuisson.', 'Porte 1 litre d''eau salée à ébullition, verse la polenta en pluie en fouettant et laisse cuire 5 minutes.', 'Hors du feu, ajoute le beurre et le parmesan râpé.']::text[],
    false, null, true, 'Steak haché', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Polenta précuite', 250::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Parmesan', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché et pâtes au pesto
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'edab42a4-3245-58a3-9f39-f4c56b92bb67', null, 'Steak haché et pâtes au pesto', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 10,
    array[]::public.diet[],
    array['Sors les steaks hachés du frigo 10 minutes avant.', 'Fais chauffer l''huile dans une poêle à feu vif et cuis les steaks 2 à 3 minutes de chaque côté. Sale et poivre en fin de cuisson.', 'Fais cuire les pâtes dans une grande casserole d''eau bouillante salée.', 'Égoutte-les et mélange-les avec le pesto. Parsème de parmesan.']::text[],
    false, null, true, 'Steak haché', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Pâtes', 400::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Pesto', 190::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Parmesan', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché et purée
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '935f2308-dc6f-5f89-bce4-784ab7c440a1', null, 'Steak haché et purée', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 12, 20,
    array['gluten_free']::public.diet[],
    array['Épluche les pommes de terre, coupe-les en morceaux et fais-les cuire 20 minutes dans l''eau salée.', 'Égoutte, écrase au presse-purée avec le lait chaud et le beurre.', 'Sors les steaks hachés du frigo 10 minutes avant.', 'Fais chauffer l''huile dans une poêle à feu vif et cuis les steaks 2 à 3 minutes de chaque côté. Sale et poivre en fin de cuisson.']::text[],
    false, null, true, 'Steak haché', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Pommes de terre', 1::numeric, 'kg'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Lait', 200::numeric, 'ml'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Beurre', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché et riz
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '3ff29a52-bec1-52b1-b49f-e35c541bc164', null, 'Steak haché et riz', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 12,
    array['gluten_free', 'lactose_free']::public.diet[],
    array['Fais cuire le riz dans l''eau bouillante salée le temps indiqué sur le paquet, puis égoutte.', 'Sors les steaks hachés du frigo 10 minutes avant.', 'Fais chauffer l''huile dans une poêle à feu vif et cuis les steaks 2 à 3 minutes de chaque côté. Sale et poivre en fin de cuisson.']::text[],
    false, null, true, 'Steak haché', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Riz', 300::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché et haricots verts
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '41f66fd6-63e9-5d33-9cc1-64ceaa70d6b1', null, 'Steak haché et haricots verts', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 10,
    array['keto', 'gluten_free']::public.diet[],
    array['Sors les steaks hachés du frigo 10 minutes avant.', 'Fais chauffer l''huile dans une poêle à feu vif et cuis les steaks 2 à 3 minutes de chaque côté. Sale et poivre en fin de cuisson.', 'Fais cuire les haricots verts 8 à 10 minutes dans l''eau bouillante salée, égoutte-les et ajoute le beurre.']::text[],
    false, null, true, 'Steak haché', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Haricots verts', 500::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle),
    (3::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché et courgettes poêlées
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '9d0261c0-01e7-5316-80fd-f6882121f14a', null, 'Steak haché et courgettes poêlées', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 7, 12,
    array['keto', 'gluten_free', 'lactose_free']::public.diet[],
    array['Sors les steaks hachés du frigo 10 minutes avant.', 'Fais chauffer l''huile dans une poêle à feu vif et cuis les steaks 2 à 3 minutes de chaque côté. Sale et poivre en fin de cuisson.', 'Coupe les courgettes en demi-rondelles et l''ail en lamelles.', 'Fais-les revenir 10 à 12 minutes dans l''huile d''olive à feu moyen-vif. Sale et poivre.']::text[],
    false, null, true, 'Steak haché', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 3::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Courgettes', 4::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Gousses d''ail', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché et brocolis
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '77f97d9e-8c37-5b4b-b44e-916e366220af', null, 'Steak haché et brocolis', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 5, 8,
    array['keto', 'gluten_free']::public.diet[],
    array['Sors les steaks hachés du frigo 10 minutes avant.', 'Fais chauffer l''huile dans une poêle à feu vif et cuis les steaks 2 à 3 minutes de chaque côté. Sale et poivre en fin de cuisson.', 'Détaille les brocolis en bouquets et fais-les cuire 6 à 8 minutes à l''eau bouillante salée ou à la vapeur.', 'Égoutte et ajoute le beurre.']::text[],
    false, null, true, 'Steak haché', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Brocolis', 500::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché et purée de chou-fleur
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '9428fc81-b359-5294-9ed8-b046f2688d41', null, 'Steak haché et purée de chou-fleur', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 7, 15,
    array['keto', 'gluten_free']::public.diet[],
    array['Sors les steaks hachés du frigo 10 minutes avant.', 'Fais chauffer l''huile dans une poêle à feu vif et cuis les steaks 2 à 3 minutes de chaque côté. Sale et poivre en fin de cuisson.', 'Détaille le chou-fleur en bouquets et fais-le cuire 15 minutes à l''eau salée, jusqu''à ce qu''il soit bien tendre.', 'Égoutte-le soigneusement, puis mixe-le avec le beurre et la crème. Sale et poivre.']::text[],
    false, null, true, 'Steak haché', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Chou-fleur', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Crème fraîche épaisse', 3::numeric, 'cas'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Côte de porc et frites
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'd62cd398-bee8-54c8-a722-ad1ed99211d3', null, 'Côte de porc et frites', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 25,
    array['lactose_free']::public.diet[],
    array['Étale les frites sur une plaque et enfourne-les à 220 °C pour 20 à 25 minutes, en les retournant à mi-cuisson.', 'Saupoudre les côtes de porc d''herbes de Provence.', 'Fais-les dorer dans l''huile chaude 5 à 6 minutes de chaque côté, à feu moyen. Sale et poivre.']::text[],
    false, null, true, 'Côte de porc', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Côtes de porc', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Herbes de Provence', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Frites surgelées au four', 800::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Côte de porc et polenta
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'd032ba3e-4464-5129-a3a5-d217b77ab3f8', null, 'Côte de porc et polenta', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 12,
    array['gluten_free']::public.diet[],
    array['Saupoudre les côtes de porc d''herbes de Provence.', 'Fais-les dorer dans l''huile chaude 5 à 6 minutes de chaque côté, à feu moyen. Sale et poivre.', 'Porte 1 litre d''eau salée à ébullition, verse la polenta en pluie en fouettant et laisse cuire 5 minutes.', 'Hors du feu, ajoute le beurre et le parmesan râpé.']::text[],
    false, null, true, 'Côte de porc', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Côtes de porc', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Herbes de Provence', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Polenta précuite', 250::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Parmesan', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Côte de porc et pâtes au pesto
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'e6294b01-a433-518e-9777-e708c48f59aa', null, 'Côte de porc et pâtes au pesto', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 12,
    array[]::public.diet[],
    array['Saupoudre les côtes de porc d''herbes de Provence.', 'Fais-les dorer dans l''huile chaude 5 à 6 minutes de chaque côté, à feu moyen. Sale et poivre.', 'Fais cuire les pâtes dans une grande casserole d''eau bouillante salée.', 'Égoutte-les et mélange-les avec le pesto. Parsème de parmesan.']::text[],
    false, null, true, 'Côte de porc', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Côtes de porc', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Herbes de Provence', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Pâtes', 400::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Pesto', 190::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Parmesan', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Côte de porc et purée
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '4d486ca9-672c-5493-80a2-f902b58e876f', null, 'Côte de porc et purée', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 12, 20,
    array['gluten_free']::public.diet[],
    array['Épluche les pommes de terre, coupe-les en morceaux et fais-les cuire 20 minutes dans l''eau salée.', 'Égoutte, écrase au presse-purée avec le lait chaud et le beurre.', 'Saupoudre les côtes de porc d''herbes de Provence.', 'Fais-les dorer dans l''huile chaude 5 à 6 minutes de chaque côté, à feu moyen. Sale et poivre.']::text[],
    false, null, true, 'Côte de porc', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Côtes de porc', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Herbes de Provence', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Pommes de terre', 1::numeric, 'kg'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Lait', 200::numeric, 'ml'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Beurre', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Côte de porc et haricots verts
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '10aa989e-ff8f-5b9c-8a60-5a85348a7509', null, 'Côte de porc et haricots verts', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 12,
    array['keto', 'gluten_free']::public.diet[],
    array['Saupoudre les côtes de porc d''herbes de Provence.', 'Fais-les dorer dans l''huile chaude 5 à 6 minutes de chaque côté, à feu moyen. Sale et poivre.', 'Fais cuire les haricots verts 8 à 10 minutes dans l''eau bouillante salée, égoutte-les et ajoute le beurre.']::text[],
    false, null, true, 'Côte de porc', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Côtes de porc', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Herbes de Provence', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Haricots verts', 500::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle),
    (4::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Côte de porc et courgettes poêlées
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'd611aeac-1a3a-5ebe-b37e-ebf3906aba28', null, 'Côte de porc et courgettes poêlées', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 7, 12,
    array['keto', 'gluten_free', 'lactose_free']::public.diet[],
    array['Saupoudre les côtes de porc d''herbes de Provence.', 'Fais-les dorer dans l''huile chaude 5 à 6 minutes de chaque côté, à feu moyen. Sale et poivre.', 'Coupe les courgettes en demi-rondelles et l''ail en lamelles.', 'Fais-les revenir 10 à 12 minutes dans l''huile d''olive à feu moyen-vif. Sale et poivre.']::text[],
    false, null, true, 'Côte de porc', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Côtes de porc', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 3::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Herbes de Provence', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Courgettes', 4::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Gousses d''ail', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Côte de porc et purée de chou-fleur
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'b00213f4-5630-5d9b-a9c6-9de89963c339', null, 'Côte de porc et purée de chou-fleur', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 7, 15,
    array['keto', 'gluten_free']::public.diet[],
    array['Saupoudre les côtes de porc d''herbes de Provence.', 'Fais-les dorer dans l''huile chaude 5 à 6 minutes de chaque côté, à feu moyen. Sale et poivre.', 'Détaille le chou-fleur en bouquets et fais-le cuire 15 minutes à l''eau salée, jusqu''à ce qu''il soit bien tendre.', 'Égoutte-le soigneusement, puis mixe-le avec le beurre et la crème. Sale et poivre.']::text[],
    false, null, true, 'Côte de porc', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Côtes de porc', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Herbes de Provence', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Chou-fleur', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Crème fraîche épaisse', 3::numeric, 'cas'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak et frites
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'c0b86f1e-e245-5117-bced-9dbad7366dab', null, 'Steak et frites', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 25,
    array['lactose_free']::public.diet[],
    array['Étale les frites sur une plaque et enfourne-les à 220 °C pour 20 à 25 minutes, en les retournant à mi-cuisson.', 'Sors les pavés du frigo 15 minutes avant.', 'Saisis-les dans l''huile très chaude 2 à 3 minutes de chaque côté selon la cuisson voulue. Laisse reposer 2 minutes, sale et poivre.']::text[],
    false, null, true, 'Steak', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Frites surgelées au four', 800::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak et purée
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '2adbde56-2cfa-518d-b930-4ae313fb3776', null, 'Steak et purée', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 12, 20,
    array['gluten_free']::public.diet[],
    array['Épluche les pommes de terre, coupe-les en morceaux et fais-les cuire 20 minutes dans l''eau salée.', 'Égoutte, écrase au presse-purée avec le lait chaud et le beurre.', 'Sors les pavés du frigo 15 minutes avant.', 'Saisis-les dans l''huile très chaude 2 à 3 minutes de chaque côté selon la cuisson voulue. Laisse reposer 2 minutes, sale et poivre.']::text[],
    false, null, true, 'Steak', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Pommes de terre', 1::numeric, 'kg'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Lait', 200::numeric, 'ml'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Beurre', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak et polenta
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'fc171e58-c6b1-5a3c-9995-c467e95b4bcf', null, 'Steak et polenta', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 6,
    array['gluten_free']::public.diet[],
    array['Sors les pavés du frigo 15 minutes avant.', 'Saisis-les dans l''huile très chaude 2 à 3 minutes de chaque côté selon la cuisson voulue. Laisse reposer 2 minutes, sale et poivre.', 'Porte 1 litre d''eau salée à ébullition, verse la polenta en pluie en fouettant et laisse cuire 5 minutes.', 'Hors du feu, ajoute le beurre et le parmesan râpé.']::text[],
    false, null, true, 'Steak', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Polenta précuite', 250::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Parmesan', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak et haricots verts
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '77c45fe9-bafe-5376-a3bd-cd7e76d96ab6', null, 'Steak et haricots verts', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 10,
    array['keto', 'gluten_free']::public.diet[],
    array['Sors les pavés du frigo 15 minutes avant.', 'Saisis-les dans l''huile très chaude 2 à 3 minutes de chaque côté selon la cuisson voulue. Laisse reposer 2 minutes, sale et poivre.', 'Fais cuire les haricots verts 8 à 10 minutes dans l''eau bouillante salée, égoutte-les et ajoute le beurre.']::text[],
    false, null, true, 'Steak', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Haricots verts', 500::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle),
    (3::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak et salade verte
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'bba737b4-fb6c-5f31-aa99-023646b72d0a', null, 'Steak et salade verte', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 7, 6,
    array['keto', 'gluten_free', 'lactose_free']::public.diet[],
    array['Sors les pavés du frigo 15 minutes avant.', 'Saisis-les dans l''huile très chaude 2 à 3 minutes de chaque côté selon la cuisson voulue. Laisse reposer 2 minutes, sale et poivre.', 'Lave et essore la salade.', 'Mélange la moutarde, le vinaigre et l''huile, sale, poivre, et assaisonne la salade au dernier moment.']::text[],
    false, null, true, 'Steak', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 4::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Salade verte', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Vinaigre de cidre', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Moutarde', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak et courgettes poêlées
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '18900d18-de88-590e-84e2-b3f0c6d82e99', null, 'Steak et courgettes poêlées', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 7, 12,
    array['keto', 'gluten_free', 'lactose_free']::public.diet[],
    array['Sors les pavés du frigo 15 minutes avant.', 'Saisis-les dans l''huile très chaude 2 à 3 minutes de chaque côté selon la cuisson voulue. Laisse reposer 2 minutes, sale et poivre.', 'Coupe les courgettes en demi-rondelles et l''ail en lamelles.', 'Fais-les revenir 10 à 12 minutes dans l''huile d''olive à feu moyen-vif. Sale et poivre.']::text[],
    false, null, true, 'Steak', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 3::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Courgettes', 4::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Gousses d''ail', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poulet et frites
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '82a0c2a2-87f5-5f1e-8f0f-aa67301f969a', null, 'Poulet et frites', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 4, 25,
    array['lactose_free']::public.diet[],
    array['Étale les frites sur une plaque et enfourne-les à 220 °C pour 20 à 25 minutes, en les retournant à mi-cuisson.', 'Coupe les blancs de poulet en deux dans l''épaisseur pour qu''ils cuisent vite, et saupoudre-les de paprika.', 'Fais-les dorer dans l''huile 5 à 6 minutes de chaque côté. Sale et poivre.']::text[],
    false, null, true, 'Poulet', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Blancs de poulet', 600::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Paprika', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Frites surgelées au four', 800::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poulet et riz
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'c3cca8e2-ee82-5d97-843e-4746bb61e361', null, 'Poulet et riz', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 4, 12,
    array['gluten_free', 'lactose_free']::public.diet[],
    array['Fais cuire le riz dans l''eau bouillante salée le temps indiqué sur le paquet, puis égoutte.', 'Coupe les blancs de poulet en deux dans l''épaisseur pour qu''ils cuisent vite, et saupoudre-les de paprika.', 'Fais-les dorer dans l''huile 5 à 6 minutes de chaque côté. Sale et poivre.']::text[],
    false, null, true, 'Poulet', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Blancs de poulet', 600::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Paprika', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Riz', 300::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poulet et pâtes au pesto
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '4a48fd7b-59e2-5605-acbb-cae8fd587d5c', null, 'Poulet et pâtes au pesto', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 4, 12,
    array[]::public.diet[],
    array['Coupe les blancs de poulet en deux dans l''épaisseur pour qu''ils cuisent vite, et saupoudre-les de paprika.', 'Fais-les dorer dans l''huile 5 à 6 minutes de chaque côté. Sale et poivre.', 'Fais cuire les pâtes dans une grande casserole d''eau bouillante salée.', 'Égoutte-les et mélange-les avec le pesto. Parsème de parmesan.']::text[],
    false, null, true, 'Poulet', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Blancs de poulet', 600::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Paprika', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Pâtes', 400::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Pesto', 190::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Parmesan', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poulet et polenta
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '718d06ba-8383-58bd-95e8-de36baab7be5', null, 'Poulet et polenta', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 4, 12,
    array['gluten_free']::public.diet[],
    array['Coupe les blancs de poulet en deux dans l''épaisseur pour qu''ils cuisent vite, et saupoudre-les de paprika.', 'Fais-les dorer dans l''huile 5 à 6 minutes de chaque côté. Sale et poivre.', 'Porte 1 litre d''eau salée à ébullition, verse la polenta en pluie en fouettant et laisse cuire 5 minutes.', 'Hors du feu, ajoute le beurre et le parmesan râpé.']::text[],
    false, null, true, 'Poulet', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Blancs de poulet', 600::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Paprika', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Polenta précuite', 250::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Parmesan', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poulet et haricots verts
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'ed5a0bc8-50b6-5997-b2f1-438ef40709c7', null, 'Poulet et haricots verts', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 4, 12,
    array['keto', 'gluten_free']::public.diet[],
    array['Coupe les blancs de poulet en deux dans l''épaisseur pour qu''ils cuisent vite, et saupoudre-les de paprika.', 'Fais-les dorer dans l''huile 5 à 6 minutes de chaque côté. Sale et poivre.', 'Fais cuire les haricots verts 8 à 10 minutes dans l''eau bouillante salée, égoutte-les et ajoute le beurre.']::text[],
    false, null, true, 'Poulet', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Blancs de poulet', 600::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Paprika', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Haricots verts', 500::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle),
    (4::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poulet et courgettes poêlées
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '2c4c70d1-ade8-50e6-8bf7-8e88eec27f5d', null, 'Poulet et courgettes poêlées', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 8, 12,
    array['keto', 'gluten_free', 'lactose_free']::public.diet[],
    array['Coupe les blancs de poulet en deux dans l''épaisseur pour qu''ils cuisent vite, et saupoudre-les de paprika.', 'Fais-les dorer dans l''huile 5 à 6 minutes de chaque côté. Sale et poivre.', 'Coupe les courgettes en demi-rondelles et l''ail en lamelles.', 'Fais-les revenir 10 à 12 minutes dans l''huile d''olive à feu moyen-vif. Sale et poivre.']::text[],
    false, null, true, 'Poulet', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Blancs de poulet', 600::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 3::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Paprika', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Courgettes', 4::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Gousses d''ail', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poulet et brocolis
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '42e7036a-ecd1-52ab-9a0a-be76c0f07ae6', null, 'Poulet et brocolis', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 6, 12,
    array['keto', 'gluten_free']::public.diet[],
    array['Coupe les blancs de poulet en deux dans l''épaisseur pour qu''ils cuisent vite, et saupoudre-les de paprika.', 'Fais-les dorer dans l''huile 5 à 6 minutes de chaque côté. Sale et poivre.', 'Détaille les brocolis en bouquets et fais-les cuire 6 à 8 minutes à l''eau bouillante salée ou à la vapeur.', 'Égoutte et ajoute le beurre.']::text[],
    false, null, true, 'Poulet', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Blancs de poulet', 600::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Paprika', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Brocolis', 500::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Saumon et riz
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '1f7931c3-2e8b-5289-aeae-362672c2399c', null, 'Saumon et riz', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 12,
    array['gluten_free', 'lactose_free']::public.diet[],
    array['Fais cuire le riz dans l''eau bouillante salée le temps indiqué sur le paquet, puis égoutte.', 'Cuis les pavés de saumon côté peau dans l''huile 5 minutes, puis 2 à 3 minutes de l''autre côté.', 'Sale, poivre et arrose d''un filet de citron.']::text[],
    false, null, true, 'Saumon', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de saumon', 4::numeric, 'piece'::public.ingredient_unit, 'poissonnerie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Citrons', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Riz', 300::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Saumon et pâtes au pesto
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '6ffea986-2326-57b6-a01f-fa65155a11be', null, 'Saumon et pâtes au pesto', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 10,
    array[]::public.diet[],
    array['Cuis les pavés de saumon côté peau dans l''huile 5 minutes, puis 2 à 3 minutes de l''autre côté.', 'Sale, poivre et arrose d''un filet de citron.', 'Fais cuire les pâtes dans une grande casserole d''eau bouillante salée.', 'Égoutte-les et mélange-les avec le pesto. Parsème de parmesan.']::text[],
    false, null, true, 'Saumon', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de saumon', 4::numeric, 'piece'::public.ingredient_unit, 'poissonnerie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Citrons', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Pâtes', 400::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Pesto', 190::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Parmesan', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Saumon et purée
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'a60829de-0651-5deb-8f5e-778ce26e5f3e', null, 'Saumon et purée', 'Le basique qui plaît à tout le monde.',
    array['midi', 'soir']::public.meal_type[], 4, 12, 20,
    array['gluten_free']::public.diet[],
    array['Épluche les pommes de terre, coupe-les en morceaux et fais-les cuire 20 minutes dans l''eau salée.', 'Égoutte, écrase au presse-purée avec le lait chaud et le beurre.', 'Cuis les pavés de saumon côté peau dans l''huile 5 minutes, puis 2 à 3 minutes de l''autre côté.', 'Sale, poivre et arrose d''un filet de citron.']::text[],
    false, null, true, 'Saumon', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de saumon', 4::numeric, 'piece'::public.ingredient_unit, 'poissonnerie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Citrons', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Pommes de terre', 1::numeric, 'kg'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Lait', 200::numeric, 'ml'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Beurre', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Saumon et haricots verts
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '2b72c728-f8f7-5af7-b1fb-465a4fc65b5e', null, 'Saumon et haricots verts', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 3, 10,
    array['keto', 'gluten_free']::public.diet[],
    array['Cuis les pavés de saumon côté peau dans l''huile 5 minutes, puis 2 à 3 minutes de l''autre côté.', 'Sale, poivre et arrose d''un filet de citron.', 'Fais cuire les haricots verts 8 à 10 minutes dans l''eau bouillante salée, égoutte-les et ajoute le beurre.']::text[],
    false, null, true, 'Saumon', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de saumon', 4::numeric, 'piece'::public.ingredient_unit, 'poissonnerie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Citrons', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Haricots verts', 500::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle),
    (4::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Saumon et brocolis
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    'a31f4c3f-6846-53ee-b23d-64e4f62b1ec7', null, 'Saumon et brocolis', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 5, 8,
    array['keto', 'gluten_free']::public.diet[],
    array['Cuis les pavés de saumon côté peau dans l''huile 5 minutes, puis 2 à 3 minutes de l''autre côté.', 'Sale, poivre et arrose d''un filet de citron.', 'Détaille les brocolis en bouquets et fais-les cuire 6 à 8 minutes à l''eau bouillante salée ou à la vapeur.', 'Égoutte et ajoute le beurre.']::text[],
    false, null, true, 'Saumon', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de saumon', 4::numeric, 'piece'::public.ingredient_unit, 'poissonnerie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Citrons', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Brocolis', 500::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Saumon et purée de chou-fleur
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
  ) values (
    '4c9c6c66-b366-5e51-a58e-e7b59a9e10a9', null, 'Saumon et purée de chou-fleur', 'La version cétogène du basique : même viande, légume à la place du féculent.',
    array['midi', 'soir']::public.meal_type[], 4, 7, 15,
    array['keto', 'gluten_free']::public.diet[],
    array['Cuis les pavés de saumon côté peau dans l''huile 5 minutes, puis 2 à 3 minutes de l''autre côté.', 'Sale, poivre et arrose d''un filet de citron.', 'Détaille le chou-fleur en bouquets et fais-le cuire 15 minutes à l''eau salée, jusqu''à ce qu''il soit bien tendre.', 'Égoutte-le soigneusement, puis mixe-le avec le beurre et la crème. Sale et poivre.']::text[],
    false, null, true, 'Saumon', true
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pavés de saumon', 4::numeric, 'piece'::public.ingredient_unit, 'poissonnerie'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Citrons', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Chou-fleur', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Crème fraîche épaisse', 3::numeric, 'cas'::public.ingredient_unit, 'cremerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);
