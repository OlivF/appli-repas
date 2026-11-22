-- Catalogue commun : 9 recettes importées de recettes-semaine-16-nov.json.
-- Fichier généré, ne pas modifier à la main. Pour le régénérer :
--   docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/json-to-catalogue.ts recettes-semaine-16-nov.json supabase/migrations/0018_week_16_nov_catalog.sql
-- Identifiants fixes dérivés du titre, « on conflict do nothing » : rejouable sans doublon.

-- Velouté de courgettes au fromage frais
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '5b00c84a-ba67-563e-9281-a55c36cf72de', null, 'Velouté de courgettes au fromage frais', 'Doux et onctueux, sans pommes de terre : toute la famille en mange, Keto compris.',
    array['midi', 'soir']::public.meal_type[], 4, 10, 25,
    array['keto', 'vegetarian']::public.diet[],
    array['Émince l''oignon et fais-le revenir 3 minutes dans l''huile d''olive.', 'Ajoute les courgettes coupées en rondelles (sans les éplucher), le cube de bouillon de légumes et de l''eau à hauteur.', 'Laisse cuire 20 minutes à petits bouillons.', 'Hors du feu, ajoute le fromage frais et mixe. Sale et poivre.']::text[],
    true, 'Se garde 3 jours au frais ou 3 mois au congélateur. Double les quantités le dimanche.', true, null, false,
    'starter'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Courgettes', 4::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Oignons', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (2::smallint, 'Fromage frais', 150::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (3::smallint, 'Bouillon cube', 1::numeric, 'piece'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (6::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Œufs coque et mouillettes
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '5a0ad5c6-4ad4-5c79-a478-41308eacf048', null, 'Œufs coque et mouillettes', 'Le dîner tout simple que les enfants adorent.',
    array['soir', 'petit_dej']::public.meal_type[], 4, 5, 4,
    array['vegetarian']::public.diet[],
    array['Sors les œufs du frigo un peu avant.', 'Porte une casserole d''eau à ébullition et plonge les œufs délicatement avec une cuillère.', 'Compte 3 minutes pour un jaune bien coulant, 4 minutes pour un blanc plus pris.', 'Pendant ce temps, coupe la baguette en mouillettes et beurre-les.']::text[],
    false, null, true, 'Œufs coque', true,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Œufs', 8::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (1::smallint, 'Baguettes', 1::numeric, 'piece'::public.ingredient_unit, 'boulangerie'::public.grocery_aisle),
    (2::smallint, 'Beurre', 40::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (3::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Œufs coque et mouillettes de jambon
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '01c141c4-54ab-5a08-af5a-f61080ef6d97', null, 'Œufs coque et mouillettes de jambon', 'Les mêmes œufs, avec des bâtonnets de jambon beurrés à la place du pain.',
    array['soir', 'petit_dej']::public.meal_type[], 2, 5, 4,
    array['keto', 'gluten_free']::public.diet[],
    array['Cuis les œufs en même temps que ceux de la famille : 3 à 4 minutes dans l''eau bouillante.', 'Roule les tranches de jambon serrées, coupe-les en bâtonnets et pose une noisette de beurre dessus.', 'Trempe les bâtonnets dans le jaune comme des mouillettes.']::text[],
    false, null, true, 'Œufs coque', true,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Œufs', 5::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (1::smallint, 'Tranches de jambon blanc', 2::numeric, 'piece'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (2::smallint, 'Beurre', 20::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (3::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Tartiflette
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '5fc118c2-4f4d-5732-813a-00a0b0e601cc', null, 'Tartiflette', 'Pommes de terre, lardons, oignons et reblochon fondant : le plat d''hiver de la famille.',
    array['soir']::public.meal_type[], 6, 20, 50,
    array['gluten_free']::public.diet[],
    array['Fais cuire les pommes de terre avec la peau 20 minutes dans l''eau salée, puis épluche-les et coupe-les en rondelles.', 'Fais revenir les oignons émincés et les lardons 8 minutes à la poêle.', 'Dans un plat à gratin, alterne pommes de terre, lardons-oignons et crème. Poivre.', 'Coupe le reblochon en deux dans l''épaisseur et pose-le dessus, croûte vers le haut.', 'Enfourne 25 minutes à 200 °C, jusqu''à ce que ce soit bien doré.']::text[],
    false, null, true, 'Reblochon', false,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pommes de terre', 1500::numeric, 'g'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Reblochon', 1::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (2::smallint, 'Lardons', 200::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (3::smallint, 'Oignons', 2::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Crème fraîche épaisse', 200::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Tartiflette de chou-fleur
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '13593b42-8595-57d9-ac39-1b03f53757dd', null, 'Tartiflette de chou-fleur', 'La tartiflette sans pommes de terre : chou-fleur, lardons et reblochon.',
    array['soir']::public.meal_type[], 4, 15, 35,
    array['keto', 'gluten_free']::public.diet[],
    array['Détaille le chou-fleur en bouquets et fais-le cuire 8 minutes à l''eau salée. Égoutte-le bien.', 'Prends une part des lardons-oignons revenus pour la tartiflette de la famille.', 'Dans un petit plat, mélange chou-fleur, lardons-oignons et crème. Poivre.', 'Couvre d''une part du reblochon et enfourne à côté de la grande tartiflette, 20 à 25 minutes à 200 °C.']::text[],
    false, null, false, 'Reblochon', false,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Choux-fleurs', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Reblochon', 0.5::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (2::smallint, 'Lardons', 150::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (3::smallint, 'Oignons', 0.5::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Crème fraîche épaisse', 100::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Salade verte
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'a30be929-4a86-5b2c-89af-2452a6d87ee4', null, 'Salade verte', 'Une belle salade et sa vinaigrette moutarde, pour accompagner un plat riche.',
    array['midi', 'soir']::public.meal_type[], 4, 5, 0,
    array['keto', 'vegetarian', 'gluten_free', 'lactose_free']::public.diet[],
    array['Lave et essore la salade.', 'Dans le saladier, mélange la moutarde, le vinaigre, le sel et le poivre, puis l''huile.', 'Ajoute la salade et remue au moment de servir.']::text[],
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
    (0::smallint, 'Salades vertes', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Huile d''olive', 3::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (2::smallint, 'Vinaigre de cidre', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Moutarde', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (4::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Pâtes à la bolognaise
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    '5a5f09fe-f6b8-5a33-8ca6-8810060a51c2', null, 'Pâtes à la bolognaise', 'La sauce tomate à la viande qui mijote, sur des spaghettis.',
    array['soir', 'midi']::public.meal_type[], 6, 15, 45,
    array[]::public.diet[],
    array['Hache l''oignon, la carotte et l''ail, et fais-les revenir 5 minutes dans l''huile.', 'Ajoute le bœuf haché et fais-le dorer en l''émiettant.', 'Verse les tomates concassées et les herbes, sale, poivre et laisse mijoter 30 minutes à couvert.', 'Fais cuire les pâtes, égoutte-les et sers avec la sauce et le parmesan.']::text[],
    true, 'La sauce se garde 3 jours au frais ou 3 mois au congélateur : fais-en le double le dimanche.', true, 'Sauce bolognaise', false,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Pâtes', 500::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (1::smallint, 'Bœuf haché', 600::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (2::smallint, 'Oignons', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (3::smallint, 'Carottes', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Gousses d''ail', 2::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (5::smallint, 'Tomates concassées', 800::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (6::smallint, 'Huile d''olive', 2::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (7::smallint, 'Herbes de Provence', 1::numeric, 'cac'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (8::smallint, 'Parmesan', 60::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (9::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (10::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Courgettes à la bolognaise
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'fab136e7-bcdf-53fd-9a97-28a51a2ae98f', null, 'Courgettes à la bolognaise', 'La même sauce, sur des tagliatelles de courgette à la place des pâtes.',
    array['soir', 'midi']::public.meal_type[], 2, 10, 45,
    array['keto', 'gluten_free']::public.diet[],
    array['Fais la sauce dans la même cocotte que celle des pâtes (les quantités sont prévues pour).', 'Taille les courgettes en tagliatelles avec un économe.', 'Poêle-les 3 minutes dans l''huile à feu vif, elles doivent rester croquantes. Sale.', 'Sers avec une louche de sauce et le parmesan.']::text[],
    false, null, false, 'Sauce bolognaise', false,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Courgettes', 2::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (1::smallint, 'Bœuf haché', 200::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (2::smallint, 'Tomates concassées', 200::numeric, 'g'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (3::smallint, 'Gousses d''ail', 1::numeric, 'piece'::public.ingredient_unit, 'fruits_legumes'::public.grocery_aisle),
    (4::smallint, 'Huile d''olive', 1::numeric, 'cas'::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (5::smallint, 'Parmesan', 30::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (6::smallint, 'Sel', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle),
    (7::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);

-- Quiche lorraine sans pâte
with recipe as (
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
  ) values (
    'a01b4df5-90b2-53d3-9b1d-55a626710fe2', null, 'Quiche lorraine sans pâte', 'Lardons, œufs, crème et gruyère, cuits en plat sans pâte.',
    array['soir', 'midi', 'pique_nique']::public.meal_type[], 4, 10, 35,
    array['keto', 'gluten_free']::public.diet[],
    array['Fais dorer les lardons 5 minutes à la poêle, sans matière grasse.', 'Bats les œufs avec la crème et poivre (pas de sel, les lardons le sont déjà).', 'Beurre un plat, répartis les lardons et le gruyère, verse l''appareil.', 'Enfourne 30 à 35 minutes à 180 °C, à côté de la quiche lorraine de la famille.']::text[],
    true, 'Se garde 3 jours au frais, bonne froide : les parts restantes font des midis à emporter.', true, 'Quiche lorraine', false,
    'main'::public.course
  )
  on conflict (id) do nothing
  returning id
)
insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
select recipe.id, item.position, item.name, item.quantity, item.unit, item.aisle
from recipe
cross join (values
    (0::smallint, 'Œufs', 5::numeric, 'piece'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (1::smallint, 'Crème fraîche épaisse', 200::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (2::smallint, 'Lardons', 200::numeric, 'g'::public.ingredient_unit, 'boucherie'::public.grocery_aisle),
    (3::smallint, 'Gruyère râpé', 80::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (4::smallint, 'Beurre', 10::numeric, 'g'::public.ingredient_unit, 'cremerie'::public.grocery_aisle),
    (5::smallint, 'Poivre', null::numeric, null::public.ingredient_unit, 'epicerie'::public.grocery_aisle)
) as item (position, name, quantity, unit, aisle);
