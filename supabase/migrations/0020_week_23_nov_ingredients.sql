-- Menu de la semaine du 23 novembre 2026 (recettes-semaine-23-nov.json), avant son import (0021) :
-- quatre produits nouveaux au référentiel commun, et le poids d'un sachet de petits pois.

-- ─── Référentiel commun ─────────────────────────────────────────────────────
-- Identifiants fixes à la suite de 0017 (174 : Reblochon). Chacun seulement s'il n'existe pas
-- déjà (même identifiant ou même nom) : la migration ne crée jamais de doublon.
-- Navets et fenouils à la pièce, comme les autres légumes ; macédoine et tapenade au poids, en
-- bocal ou en conserve, sans date limite (comme le coulis de tomate ou le thon).
insert into public.ingredients (id, household_id, name, aisle, shopping_unit, aliases, pantry, piece_grams, grams_per_ml, shelf_life_days)
values
  ('1d9e0000-0000-4000-8000-000000000175', null, 'Navets', 'fruits_legumes', 'piece', '{}', false, null, null, 14),
  ('1d9e0000-0000-4000-8000-000000000176', null, 'Fenouils', 'fruits_legumes', 'piece', '{}', false, null, null, 7),
  ('1d9e0000-0000-4000-8000-000000000177', null, 'Macédoine de légumes', 'epicerie', 'g', '{macédoine}', false, null, null, null),
  ('1d9e0000-0000-4000-8000-000000000178', null, 'Tapenade', 'epicerie', 'g', '{}', false, null, null, null)
on conflict do nothing;

-- ─── Petits pois surgelés ───────────────────────────────────────────────────
-- Achetés à la pièce (0009, n° 149) : un sachet d'1 kg. Sans ce poids, les 400 g d'une recette ne
-- se convertissent pas en sachets dans la liste de courses.
update public.ingredients
set piece_grams = 1000
where id = '1d9e0000-0000-4000-8000-000000000149'
  and piece_grams is null;
