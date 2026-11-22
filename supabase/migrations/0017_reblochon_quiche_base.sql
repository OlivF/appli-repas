-- Menu de la semaine du 16 novembre 2026 (recettes-semaine-16-nov.json), avant son import (0018) :
-- un produit nouveau au référentiel commun, et la quiche lorraine du catalogue qui s'associe à sa
-- version sans pâte.

-- ─── Référentiel commun ─────────────────────────────────────────────────────
-- Le reblochon de la tartiflette (et de sa version au chou-fleur), à la pièce : un reblochon
-- entier pèse environ 450 g. Identifiant fixe à la suite de 0015 (173 : Fromage de chèvre).
insert into public.ingredients (id, household_id, name, aisle, shopping_unit, aliases, pantry, piece_grams, grams_per_ml, shelf_life_days)
values ('1d9e0000-0000-4000-8000-000000000174', null, 'Reblochon', 'cremerie', 'piece', '{}', false, 450, null, 14);

-- ─── Quiche lorraine ────────────────────────────────────────────────────────
-- « Quiche lorraine et salade verte » (0003, n° 16) prend la base « Quiche lorraine » : elle
-- s'associe à « Quiche lorraine sans pâte » (0018) et se cuisine avec. Ses copies de foyer sans
-- base la prennent aussi (la copie remplace l'original dans le foyer, comme dans 0006).
update public.recipes r
set base = 'Quiche lorraine'
where (r.id = 'ca7a0000-0000-4000-8000-000000000016' and r.household_id is null)
   or (r.source_recipe_id = 'ca7a0000-0000-4000-8000-000000000016' and r.base is null);
