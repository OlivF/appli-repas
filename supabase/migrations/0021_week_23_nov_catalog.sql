-- Catalogue commun : 10 recettes importées de recettes-semaine-23-nov.json.
-- Fichier généré, ne pas modifier à la main. Pour le régénérer :
--   docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/json-to-catalogue.ts recettes-semaine-23-nov.json supabase/migrations/0021_week_23_nov_catalog.sql
-- Identifiants fixes dérivés du titre, « on conflict do nothing » : rejouable sans doublon.

-- Macédoine au thon
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '64002725-066e-5a80-9a7e-77fad9f9dedf', null, 'Macédoine au thon', 'Macédoine de légumes, thon et mayonnaise : une entrée fraîche toute prête.',
    array['midi', 'soir', 'pique_nique']::public.meal_type[], 2, 5, 0,
    array['gluten_free', 'lactose_free']::public.diet[],
    array['Égoutte la macédoine et le thon.', 'Mélange-les avec la mayonnaise, poivre et garde au frais jusqu''au repas.']::text[],
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
    (0::smallint, 'Macédoine de légumes', 200::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (1::smallint, 'Thon au naturel', 100::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Mayonnaise', 2::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Gratin de navets au saumon
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'a32d8560-2793-558d-95cc-174de651afa7', null, 'Gratin de navets au saumon', 'Navets fondants, saumon et crème sous une croûte de fromage.',
    array['midi', 'soir']::public.meal_type[], 2, 15, 35,
    array['keto', 'gluten_free']::public.diet[],
    array['Épluche les navets, coupe-les en fines rondelles et fais-les cuire 10 minutes à l''eau salée.', 'Retire la peau du saumon et coupe-le en gros dés.', 'Dans un plat, mélange navets, saumon et crème. Sale, poivre et couvre de gruyère.', 'Enfourne 25 minutes à 200 °C.']::text[],
    true, 'Se prépare la veille ou le dimanche : 2 jours au frais, se réchauffe 15 minutes au four.', false, 'Saumon', false,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Navets', 3::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Pavés de saumon', 2::numeric, 'piece'::public.ingredient_unit, 'poissonnerie'::public.grocery_aisle),
    (2::smallint, 'Crème fraîche épaisse', 100::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (3::smallint, 'Gruyère râpé', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poisson pané, polenta à la tomate et petits pois
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '6db330ab-67eb-52d3-aafa-c4793593b1d8', null, 'Poisson pané, polenta à la tomate et petits pois', 'Le dîner que les enfants réclament : poisson croustillant, polenta rouge et petits pois.',
    array['soir', 'midi']::public.meal_type[], 4, 5, 20,
    array[]::public.diet[],
    array['Enfourne les poissons panés à 220 °C pour 15 à 20 minutes, en les retournant à mi-cuisson.', 'Fais cuire les petits pois 8 minutes à l''eau bouillante salée, égoutte et ajoute une noisette de beurre.', 'Porte 800 ml d''eau salée et le coulis de tomate à ébullition, verse la polenta en pluie en fouettant et laisse cuire 5 minutes.', 'Hors du feu, ajoute le reste du beurre et le parmesan.']::text[],
    false, null, true, 'Poisson pané', true,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Poisson pané', 8::numeric, 'piece'::public.ingredient_unit, 'surgeles'::public.grocery_aisle),
    (1::smallint, 'Polenta précuite', 200::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Coulis de tomate', 200::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Petits pois surgelés', 400::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle),
    (4::smallint, 'Beurre', 20::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Parmesan', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (6::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Omelette au fromage
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '6012a66b-630b-51d7-beab-4d587de3ec74', null, 'Omelette au fromage', 'Bien baveuse et filante, pour toute la tablée.',
    array['soir', 'midi']::public.meal_type[], 4, 5, 8,
    array['keto', 'vegetarian', 'gluten_free']::public.diet[],
    array['Bats les œufs avec une pincée de sel et de poivre.', 'Fais mousser le beurre dans une grande poêle, verse les œufs et remue doucement les bords vers le centre.', 'Quand le dessus est encore baveux, parsème de gruyère, plie l''omelette en deux et sers aussitôt.']::text[],
    false, null, true, 'Omelette', true,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Œufs', 9::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (1::smallint, 'Gruyère râpé', 80::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (2::smallint, 'Beurre', 20::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (3::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Omelette et fenouil braisé
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '8df09927-e9c0-5c90-b578-5dcc788cacc9', null, 'Omelette et fenouil braisé', 'Une omelette au parmesan et du fenouil fondant, légèrement anisé.',
    array['midi', 'soir']::public.meal_type[], 1, 5, 20,
    array['keto', 'vegetarian', 'gluten_free']::public.diet[],
    array['Coupe le fenouil en fines lamelles et fais-le dorer 15 minutes dans l''huile, à couvert, avec un fond d''eau.', 'Bats les œufs avec le parmesan, sale et poivre.', 'Verse-les sur le fenouil et laisse prendre 3 à 4 minutes à feu doux.']::text[],
    false, null, false, 'Omelette', false,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Œufs', 3::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (1::smallint, 'Fenouils', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (2::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Parmesan', 15::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poulet et gratin dauphinois
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'd9690c0d-f1ec-52b0-b85f-f70675d0a08c', null, 'Poulet et gratin dauphinois', 'Le poulet doré et le gratin crémeux du dimanche, en semaine.',
    array['soir']::public.meal_type[], 4, 20, 60,
    array['gluten_free']::public.diet[],
    array['Épluche les pommes de terre et coupe-les en rondelles fines, sans les laver.', 'Frotte un plat avec l''ail coupé en deux puis beurre-le. Range les pommes de terre, sale et poivre.', 'Verse le lait et la crème mélangés à hauteur, enfourne 1 heure à 170 °C.', 'Un quart d''heure avant la fin, fais dorer les blancs de poulet dans l''huile 5 à 6 minutes de chaque côté.']::text[],
    true, 'Le gratin se fait la veille : il est encore meilleur réchauffé 20 minutes au four.', true, 'Poulet', false,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Blancs de poulet', 600::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Pommes de terre', 1000::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (2::smallint, 'Crème liquide', 300::numeric, 'ml'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (3::smallint, 'Lait', 200::numeric, 'ml'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Gousses d''ail', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (5::smallint, 'Beurre', 20::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (6::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (7::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (8::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché et navets poêlés
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '61b0df49-813a-579c-8a38-9edab2be3528', null, 'Steak haché et navets poêlés', 'Des navets dorés au beurre, presque sucrés, avec un steak haché.',
    array['midi', 'soir']::public.meal_type[], 1, 5, 15,
    array['keto', 'gluten_free']::public.diet[],
    array['Épluche les navets et coupe-les en petits cubes.', 'Fais-les dorer 12 minutes au beurre à feu moyen, en remuant. Sale et ajoute le persil.', 'Cuis le steak haché 2 à 3 minutes de chaque côté dans la même poêle.']::text[],
    false, null, true, 'Steak haché', true,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 1::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Navets', 2::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (2::smallint, 'Beurre', 15::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (3::smallint, 'Persil', 1::numeric, 'cas'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Poulet et fenouil rôti
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '77c33054-78f3-53ee-aaaf-4392edd470fa', null, 'Poulet et fenouil rôti', 'Fenouil rôti au citron et blanc de poulet, chaud ou froid à emporter.',
    array['midi', 'soir']::public.meal_type[], 1, 5, 25,
    array['keto', 'gluten_free', 'lactose_free']::public.diet[],
    array['Coupe le fenouil en quartiers, arrose d''huile et de jus de citron, sale et enfourne 25 minutes à 200 °C.', 'À mi-cuisson, pose le blanc de poulet assaisonné d''herbes à côté et laisse cuire 12 à 15 minutes.']::text[],
    false, null, false, 'Poulet', false,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Blancs de poulet', 150::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Fenouils', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (2::smallint, 'Huile d''olive', 2::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Citrons', 0.5::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Herbes de Provence', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (6::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Tomates à la tapenade
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '1310a434-0fa2-5aca-9f1e-b9ed276d1181', null, 'Tomates à la tapenade', 'Tomates en rondelles et une cuillère de tapenade aux olives.',
    array['midi', 'soir']::public.meal_type[], 4, 5, 0,
    array['keto', 'vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array['Coupe les tomates en rondelles et dispose-les sur un plat.', 'Ajoute la tapenade par petites touches, un filet d''huile et poivre.']::text[],
    false, null, false, null, false,
    'starter'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Tomates', 4::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Tapenade', 60::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Steak haché, haricots verts et polenta
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'ed1bc18f-83bf-5274-914a-c4698fc3e54b', null, 'Steak haché, haricots verts et polenta', 'Le steak haché avec les deux : haricots verts et polenta crémeuse.',
    array['midi', 'soir']::public.meal_type[], 4, 5, 15,
    array['gluten_free']::public.diet[],
    array['Fais cuire les haricots verts 10 minutes à l''eau bouillante salée, égoutte et ajoute une noisette de beurre.', 'Porte 600 ml d''eau salée à ébullition, verse la polenta en pluie en fouettant et laisse cuire 5 minutes. Hors du feu, ajoute le reste du beurre et le parmesan.', 'Cuis les steaks hachés 2 à 3 minutes de chaque côté dans l''huile bien chaude. Sale et poivre.']::text[],
    false, null, true, 'Steak haché', true,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Steaks hachés pur bœuf', 4::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (1::smallint, 'Haricots verts', 400::numeric, 'g'::public.ingredient_unit, 'surgeles'::public.grocery_aisle),
    (2::smallint, 'Polenta précuite', 150::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Beurre', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Parmesan', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (6::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (7::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);
