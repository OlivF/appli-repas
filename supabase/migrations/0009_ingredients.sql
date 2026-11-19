-- Référentiel d'ingrédients : un ingrédient canonique (son nom dans la liste de courses, son rayon,
-- son unité d'achat et de quoi convertir), commun à tous (household_id null, lisible par tous,
-- modifiable par personne) ou propre à un foyer. Chaque ligne de recette y est rattachée
-- (recipe_ingredients.ingredient_id) : la liste de courses additionne par ingrédient canonique,
-- le frigo et le menu par IA s'en serviront ensuite. Le nom de la ligne reste celui de la recette.

-- ─── Types ──────────────────────────────────────────────────────────────────
-- L'unité dans laquelle on achète : au poids, au volume, à la pièce.
create type public.shopping_unit as enum ('g', 'ml', 'piece');

-- ─── Normalisation ──────────────────────────────────────────────────────────
-- Clé de comparaison d'un nom : minuscules, ligatures et accents retirés, ponctuation en espaces,
-- espaces repliés ; chaque mot de plus de trois lettres perd un s ou un x final (pluriel simple :
-- « Pommes de terre » → « pomme de terre », « Œufs » → « oeuf », « Riz » reste « riz »).
-- Immuable et sans extension (unaccent ne l'est pas) : elle sert dans une colonne générée.
create function private.ingredient_key(raw text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(string_agg(
           case when length(word) > 3 and right(word, 1) in ('s', 'x') then left(word, -1) else word end,
           ' ' order by n),
         '')
  from regexp_split_to_table(
         btrim(regexp_replace(
           regexp_replace(
             translate(
               replace(replace(lower(coalesce(raw, '')), 'œ', 'oe'), 'æ', 'ae'),
               'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ’',
               'aaaaaaceeeeiiiinooooouuuuyy'''),
             '[^a-z0-9'']+', ' ', 'g'),
           '\s+', ' ', 'g')),
         ' ') with ordinality as t (word, n)
  where word <> '';
$$;

-- ─── Table ──────────────────────────────────────────────────────────────────
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  -- Nom affiché dans la liste, au pluriel quand ça se compte (« Oignons », « Œufs »).
  name text not null check (char_length(btrim(name)) between 1 and 80),
  name_key text generated always as (private.ingredient_key(name)) stored,
  aisle public.grocery_aisle not null default 'autre',
  shopping_unit public.shopping_unit not null default 'piece',
  -- Poids moyen d'une pièce (g), densité (g par ml) : pour convertir les unités des recettes.
  piece_grams numeric(8, 2) check (piece_grams > 0),
  grams_per_ml numeric(5, 3) check (grams_per_ml > 0),
  -- Autres façons de l'écrire, normalisées comme name_key (par trigger).
  aliases text[] not null default '{}',
  -- Produit de placard qu'on a presque toujours (sel, poivre, huiles, épices…).
  pantry boolean not null default false,
  -- Durée de conservation : servira au frigo, inutilisée pour l'instant.
  shelf_life_days integer check (shelf_life_days > 0),
  created_at timestamptz not null default now(),
  -- Nom unique par foyer, et dans le commun, après normalisation.
  constraint ingredients_household_name_key unique nulls not distinct (household_id, name_key)
);
comment on table public.ingredients is 'Référentiel d''ingrédients canoniques (commun + propres au foyer)';
comment on column public.ingredients.household_id is 'null = référentiel commun';
create index ingredients_household_id_idx on public.ingredients (household_id);

-- Les alias sont stockés normalisés, sans doublon ni la clé du nom lui-même.
create function private.normalize_ingredient_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aliases := array(
    select distinct private.ingredient_key(alias)
    from unnest(new.aliases) as alias
    where private.ingredient_key(alias) not in ('', private.ingredient_key(new.name))
    order by 1
  );
  return new;
end;
$$;

create trigger ingredients_normalize_aliases
  before insert or update of name, aliases on public.ingredients
  for each row execute function private.normalize_ingredient_aliases();

alter table public.recipe_ingredients
  add column ingredient_id uuid references public.ingredients (id) on delete set null;
comment on column public.recipe_ingredients.ingredient_id is 'Ingrédient canonique (courses) ; name reste le texte de la recette';
create index recipe_ingredients_ingredient_id_idx on public.recipe_ingredients (ingredient_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.ingredients enable row level security;
revoke all on public.ingredients from anon;

create policy "Users read the common and their ingredients" on public.ingredients
  for select to authenticated
  using (household_id is null or private.is_household_member(household_id));

-- is_household_member(null) est faux : le commun est intouchable.
create policy "Users manage their ingredients" on public.ingredients
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Retrouver, ou créer, un ingrédient ─────────────────────────────────────
-- Par nom ou alias normalisés, d'abord dans le foyer, puis dans le commun ; un nom avant un alias.
-- household null : le commun seulement. La RLS s'applique.
create function private.find_ingredient(household uuid, raw_name text)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id
  from public.ingredients i
  where (i.household_id = household or i.household_id is null)
    and private.ingredient_key(raw_name) <> ''
    and (i.name_key = private.ingredient_key(raw_name) or private.ingredient_key(raw_name) = any (i.aliases))
  order by (i.household_id is null), (i.name_key <> private.ingredient_key(raw_name))
  limit 1;
$$;

-- Comme find_ingredient ; à défaut, crée l'ingrédient (dans le foyer, ou dans le commun quand
-- household est null : seul le propriétaire de la base, dans une migration, en a le droit) avec ce
-- rayon et une unité d'achat déduite de l'unité de la recette.
create function private.match_ingredient(
  household uuid,
  raw_name text,
  aisle public.grocery_aisle,
  unit public.ingredient_unit
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean text := btrim(regexp_replace(coalesce(raw_name, ''), '\s+', ' ', 'g'));
  found_id uuid;
begin
  if private.ingredient_key(clean) = '' then
    return null;
  end if;

  found_id := private.find_ingredient(household, clean);
  if found_id is not null then
    return found_id;
  end if;

  insert into public.ingredients (household_id, name, aisle, shopping_unit)
  values (
    household,
    clean,
    coalesce(aisle, 'autre'),
    case
      when unit in ('g', 'kg') then 'g'
      when unit in ('ml', 'l', 'cas', 'cac') then 'ml'
      else 'piece'
    end::public.shopping_unit
  )
  on conflict (household_id, name_key) do nothing
  returning id into found_id;

  -- Créé entre-temps par une autre transaction.
  return coalesce(found_id, private.find_ingredient(household, clean));
end;
$$;

revoke all on function private.find_ingredient(uuid, text) from public, anon;
revoke all on function private.match_ingredient(uuid, text, public.grocery_aisle, public.ingredient_unit) from public, anon;
grant execute on function private.find_ingredient(uuid, text) to authenticated;
grant execute on function private.match_ingredient(uuid, text, public.grocery_aisle, public.ingredient_unit) to authenticated;

-- ─── Rattacher chaque ligne de recette ──────────────────────────────────────
-- À l'insertion (save_recipe, catalogue, futurs lots JSON, seed) et quand le nom change. Nommé
-- pour passer après recipe_ingredients_set_household (ordre alphabétique) : le foyer est connu.
create function private.set_recipe_ingredient_ref()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.ingredient_id is not distinct from old.ingredient_id then
    new.ingredient_id := null;
  end if;
  if new.ingredient_id is null then
    new.ingredient_id := private.match_ingredient(new.household_id, new.name, new.aisle, new.unit);
  end if;
  return new;
end;
$$;

create trigger recipe_ingredients_set_ingredient
  before insert or update of name on public.recipe_ingredients
  for each row execute function private.set_recipe_ingredient_ref();

-- ─── Copier une recette du catalogue ────────────────────────────────────────
-- Comme dans 0006, en recopiant l'ingrédient canonique de chaque ligne.
create or replace function public.copy_recipe(catalog_recipe_id uuid, target_household_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  copy_id uuid;
begin
  select r.id into copy_id
  from public.recipes r
  where r.household_id = target_household_id
    and r.source_recipe_id = catalog_recipe_id;
  if copy_id is not null then
    return copy_id;
  end if;

  insert into public.recipes (
    household_id, source_recipe_id, title, description, photo_url, meal_types, servings,
    prep_minutes, cook_minutes, diets, steps, batch_friendly, batch_notes, kid_friendly,
    base, basic
  )
  select target_household_id, r.id, r.title, r.description, r.photo_url, r.meal_types,
         r.servings, r.prep_minutes, r.cook_minutes, r.diets, r.steps, r.batch_friendly,
         r.batch_notes, r.kid_friendly, r.base, r.basic
  from public.recipes r
  where r.id = catalog_recipe_id
    and r.household_id is null
  returning id into copy_id;

  if copy_id is null then
    raise exception 'Recette du catalogue introuvable' using errcode = 'no_data_found';
  end if;

  insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle, ingredient_id)
  select copy_id, ri.position, ri.name, ri.quantity, ri.unit, ri.aisle, ri.ingredient_id
  from public.recipe_ingredients ri
  where ri.recipe_id = catalog_recipe_id;

  update public.recipe_favorites f
  set recipe_id = copy_id
  where f.household_id = target_household_id
    and f.recipe_id = catalog_recipe_id;

  update public.recipe_member_exclusions e
  set recipe_id = copy_id
  where e.household_id = target_household_id
    and e.recipe_id = catalog_recipe_id;

  update public.planned_meals p
  set recipe_id = copy_id
  where p.household_id = target_household_id
    and p.recipe_id = catalog_recipe_id;

  return copy_id;
end;
$$;

-- ─── Ingrédients connus (autocomplétion du formulaire) ──────────────────────
-- Le référentiel : un nom par clé (celui du foyer avant le commun), son rayon, et l'unité la plus
-- utilisée dans les recettes visibles (à défaut, l'unité d'achat).
create or replace view public.known_ingredients
with (security_invoker = true)
as
select distinct on (i.name_key)
  i.name,
  i.aisle,
  coalesce(
    (select ri.unit
     from public.recipe_ingredients ri
     where ri.ingredient_id = i.id
       and ri.unit is not null
     group by ri.unit
     order by count(*) desc, ri.unit
     limit 1),
    i.shopping_unit::text::public.ingredient_unit
  ) as unit
from public.ingredients i
order by i.name_key, (i.household_id is null), i.name;

revoke all on public.known_ingredients from anon;

-- ─── Référentiel commun ─────────────────────────────────────────────────────
-- Identifiants fixes (1d9e0000-0000-4000-8000-0000000000NN) : une future migration peut corriger
-- un ingrédient précis. Colonnes : n, nom, rayon, unité d'achat, alias, placard, poids d'une pièce
-- (g), densité (g/ml). Densités et poids seulement quand une conversion réelle en a besoin.
--   1-104   ingrédients du catalogue (0003, 0007), une seule fusion : « Laitue » → « Salades vertes »
--   105-170 produits courants du drive, pour l'autocomplétion
insert into public.ingredients (id, household_id, name, aisle, shopping_unit, aliases, pantry, piece_grams, grams_per_ml)
select ('1d9e0000-0000-4000-8000-' || lpad(item.n::text, 12, '0'))::uuid, null, item.name,
       item.aisle::public.grocery_aisle, item.unit::public.shopping_unit, item.aliases, item.pantry,
       item.piece_grams, item.grams_per_ml
from (values
  -- Fruits et légumes
  (1, 'Avocats', 'fruits_legumes', 'piece', '{}'::text[], false, null::numeric, null::numeric),
  (2, 'Bananes', 'fruits_legumes', 'piece', '{}', false, null, null),
  (3, 'Brocolis', 'fruits_legumes', 'g', '{}', false, null, null),
  (4, 'Carottes', 'fruits_legumes', 'piece', '{}', false, null, null),
  (5, 'Champignons de Paris', 'fruits_legumes', 'g', '{"champignons", "champignons blancs"}', false, null, null),
  (6, 'Choux-fleurs', 'fruits_legumes', 'piece', '{}', false, null, null),
  (7, 'Citrons', 'fruits_legumes', 'piece', '{"citrons jaunes"}', false, null, null),
  (8, 'Concombres', 'fruits_legumes', 'piece', '{}', false, null, null),
  (9, 'Courgettes', 'fruits_legumes', 'piece', '{}', false, null, null),
  (10, 'Échalotes', 'fruits_legumes', 'piece', '{}', false, null, null),
  (11, 'Épinards frais', 'fruits_legumes', 'g', '{"épinards", "pousses d''épinards"}', false, null, null),
  (12, 'Framboises', 'fruits_legumes', 'g', '{}', false, null, null),
  (13, 'Gousses d''ail', 'fruits_legumes', 'piece', '{"ail", "tête d''ail"}', false, null, null),
  (14, 'Jeunes pousses', 'fruits_legumes', 'g', '{"mesclun", "salade jeunes pousses"}', false, null, null),
  (15, 'Oignons', 'fruits_legumes', 'piece', '{"oignons jaunes"}', false, null, null),
  (16, 'Poivrons', 'fruits_legumes', 'piece', '{}', false, null, null),
  (17, 'Pommes', 'fruits_legumes', 'piece', '{}', false, null, null),
  (18, 'Pommes de terre', 'fruits_legumes', 'g', '{"patates"}', false, null, null),
  (19, 'Potimarron', 'fruits_legumes', 'g', '{}', false, null, null),
  (20, 'Radis', 'fruits_legumes', 'piece', '{}', false, null, null),
  (21, 'Salades vertes', 'fruits_legumes', 'piece', '{"laitue", "batavia", "salade"}', false, null, null),
  (22, 'Tomates', 'fruits_legumes', 'piece', '{}', false, null, null),
  (23, 'Tomates cerises', 'fruits_legumes', 'g', '{}', false, null, null),
  -- Herbes fraîches : un bouquet ; les cuillères des recettes restent telles quelles.
  (24, 'Aneth', 'fruits_legumes', 'piece', '{}', false, null, null),
  (25, 'Ciboulette', 'fruits_legumes', 'piece', '{}', false, null, null),
  (26, 'Feuilles de basilic', 'fruits_legumes', 'piece', '{"basilic", "basilic frais"}', false, null, null),
  (27, 'Menthe', 'fruits_legumes', 'piece', '{"menthe fraîche"}', false, null, null),
  (28, 'Persil', 'fruits_legumes', 'piece', '{"persil plat", "persil frais"}', false, null, null),
  -- Boucherie
  (29, 'Blancs de poulet', 'boucherie', 'g', '{"filets de poulet", "escalopes de poulet"}', false, null, null),
  (30, 'Bœuf haché', 'boucherie', 'g', '{"viande hachée", "viande hachée de bœuf"}', false, null, null),
  (31, 'Côtes de porc', 'boucherie', 'piece', '{}', false, null, null),
  (32, 'Lardons', 'boucherie', 'g', '{"lardons fumés"}', false, null, null),
  (33, 'Pavés de bœuf', 'boucherie', 'piece', '{"steaks de bœuf"}', false, null, null),
  (34, 'Poulets entiers', 'boucherie', 'piece', '{}', false, null, null),
  (35, 'Steaks hachés pur bœuf', 'boucherie', 'piece', '{"steaks hachés", "steaks hachés de bœuf"}', false, null, null),
  (36, 'Tranches de bacon', 'boucherie', 'piece', '{"bacon"}', false, null, null),
  (37, 'Tranches de blanc de dinde', 'boucherie', 'piece', '{"blanc de dinde"}', false, null, null),
  (38, 'Tranches de jambon blanc', 'boucherie', 'piece', '{"jambon blanc", "jambon"}', false, null, null),
  -- Poissonnerie
  (39, 'Pavés de saumon', 'poissonnerie', 'piece', '{"filets de saumon"}', false, null, null),
  (40, 'Saumon fumé', 'poissonnerie', 'g', '{}', false, null, null),
  -- Crèmerie
  (41, 'Beurre', 'cremerie', 'g', '{"beurre doux"}', false, null, null),
  (42, 'Billes de mozzarella', 'cremerie', 'g', '{"mini mozzarella"}', false, null, null),
  (43, 'Crème fraîche épaisse', 'cremerie', 'g', '{"crème fraîche", "crème épaisse"}', false, null, 1),
  (44, 'Crème liquide', 'cremerie', 'ml', '{"crème fraîche liquide", "crème entière liquide"}', false, null, null),
  (45, 'Feta', 'cremerie', 'g', '{}', false, null, null),
  (46, 'Fromage frais', 'cremerie', 'g', '{"fromage frais nature"}', false, null, null),
  (47, 'Gruyère râpé', 'cremerie', 'g', '{"fromage râpé"}', false, null, null),
  (48, 'Houmous', 'cremerie', 'g', '{"hummus"}', false, null, null),
  (49, 'Lait', 'cremerie', 'ml', '{"lait demi-écrémé", "lait entier"}', false, null, null),
  (50, 'Mozzarella', 'cremerie', 'g', '{"boule de mozzarella"}', false, null, null),
  (51, 'Mozzarella râpée', 'cremerie', 'g', '{}', false, null, null),
  (52, 'Œufs', 'cremerie', 'piece', '{"oeufs frais"}', false, null, null),
  (53, 'Parmesan', 'cremerie', 'g', '{"parmesan râpé", "parmigiano"}', false, null, null),
  (54, 'Pâtes brisées', 'cremerie', 'piece', '{"pâte à tarte"}', false, null, null),
  (55, 'Yaourts nature', 'cremerie', 'piece', '{}', false, null, null),
  -- Boulangerie
  (56, 'Baguettes', 'boulangerie', 'piece', '{"baguette tradition"}', false, null, null),
  (57, 'Tranches de pain de campagne', 'boulangerie', 'piece', '{"pain de campagne"}', false, null, null),
  (58, 'Tranches de pain de mie', 'boulangerie', 'piece', '{}', false, null, null),
  (59, 'Tranches de pain rassis', 'boulangerie', 'piece', '{"pain rassis"}', false, null, null),
  -- Épicerie
  (60, 'Amandes', 'epicerie', 'g', '{}', false, null, null),
  (61, 'Compotes en gourde', 'epicerie', 'piece', '{"gourdes de compote", "compotes"}', false, null, null),
  (62, 'Confiture', 'epicerie', 'g', '{}', false, null, null),
  (63, 'Coquillettes', 'epicerie', 'g', '{}', false, null, null),
  (64, 'Cornichons', 'epicerie', 'piece', '{}', false, null, null),
  (65, 'Coulis de tomate', 'epicerie', 'g', '{"sauce tomate", "passata"}', false, null, null),
  (66, 'Filets d''anchois', 'epicerie', 'piece', '{"anchois"}', false, null, null),
  (67, 'Flocons d''avoine', 'epicerie', 'g', '{}', false, null, null),
  (68, 'Graines de chia', 'epicerie', 'g', '{"chia"}', false, null, 0.8),
  (69, 'Gressins', 'epicerie', 'piece', '{}', false, null, null),
  (70, 'Haricots rouges', 'epicerie', 'g', '{}', false, null, null),
  (71, 'Lait de coco', 'epicerie', 'ml', '{}', false, null, null),
  (72, 'Maïs', 'epicerie', 'g', '{}', false, null, null),
  (73, 'Noix', 'epicerie', 'g', '{"cerneaux de noix"}', false, null, null),
  (74, 'Olives noires', 'epicerie', 'g', '{}', false, null, null),
  (75, 'Pâtes', 'epicerie', 'g', '{}', false, null, null),
  (76, 'Pâtes à lasagne', 'epicerie', 'g', '{"feuilles de lasagne", "lasagnes"}', false, null, null),
  (77, 'Pesto', 'epicerie', 'g', '{"pesto vert", "pesto au basilic"}', false, null, null),
  (78, 'Pois chiches', 'epicerie', 'g', '{}', false, null, null),
  (79, 'Polenta précuite', 'epicerie', 'g', '{"polenta"}', false, null, null),
  (80, 'Poudre d''amande', 'epicerie', 'g', '{"amandes en poudre", "poudre d''amandes"}', false, null, null),
  (81, 'Raisins secs', 'epicerie', 'g', '{}', false, null, null),
  (82, 'Riz', 'epicerie', 'g', '{"riz basmati", "riz long"}', false, null, null),
  (83, 'Thon au naturel', 'epicerie', 'g', '{"thon en boîte", "thon"}', false, null, null),
  (84, 'Tomates concassées', 'epicerie', 'g', '{}', false, null, null),
  (85, 'Tortillas de blé', 'epicerie', 'piece', '{"wraps", "tortillas"}', false, null, null),
  -- Épicerie, placard
  (86, 'Cannelle', 'epicerie', 'piece', '{"cannelle en poudre"}', true, null, null),
  (87, 'Cumin', 'epicerie', 'piece', '{}', true, null, null),
  (88, 'Curry en poudre', 'epicerie', 'piece', '{"curry"}', true, null, null),
  (89, 'Extrait de vanille', 'epicerie', 'piece', '{"vanille"}', true, null, null),
  (90, 'Farine', 'epicerie', 'g', '{"farine de blé"}', true, null, null),
  (91, 'Herbes de Provence', 'epicerie', 'piece', '{}', true, null, null),
  (92, 'Huile d''olive', 'epicerie', 'ml', '{}', true, null, 0.92),
  (93, 'Huile de tournesol', 'epicerie', 'ml', '{"huile neutre"}', true, null, 0.92),
  (94, 'Levure chimique', 'epicerie', 'g', '{"levure"}', true, null, null),
  (95, 'Mayonnaise', 'epicerie', 'piece', '{}', true, null, null),
  (96, 'Miel', 'epicerie', 'piece', '{}', true, null, null),
  (97, 'Moutarde', 'epicerie', 'piece', '{"moutarde de dijon"}', true, null, null),
  (98, 'Paprika', 'epicerie', 'piece', '{}', true, null, null),
  (99, 'Poivre', 'epicerie', 'piece', '{"poivre noir", "poivre moulu"}', true, null, null),
  (100, 'Sel', 'epicerie', 'piece', '{"sel fin", "gros sel"}', true, null, null),
  (101, 'Sucre', 'epicerie', 'g', '{"sucre en poudre", "sucre blanc"}', true, null, null),
  (102, 'Vinaigre de cidre', 'epicerie', 'piece', '{}', true, null, null),
  -- Surgelés
  (103, 'Frites surgelées au four', 'surgeles', 'g', '{"frites surgelées", "frites au four", "frites"}', false, null, null),
  (104, 'Haricots verts', 'surgeles', 'g', '{}', false, null, null),
  -- ── Produits courants du drive ──
  (105, 'Abricots', 'fruits_legumes', 'piece', '{}', false, null, null),
  (106, 'Cerises', 'fruits_legumes', 'piece', '{}', false, null, null),
  (107, 'Clémentines', 'fruits_legumes', 'piece', '{"mandarines"}', false, null, null),
  (108, 'Fraises', 'fruits_legumes', 'piece', '{}', false, null, null),
  (109, 'Kiwis', 'fruits_legumes', 'piece', '{}', false, null, null),
  (110, 'Melons', 'fruits_legumes', 'piece', '{}', false, null, null),
  (111, 'Nectarines', 'fruits_legumes', 'piece', '{}', false, null, null),
  (112, 'Oranges', 'fruits_legumes', 'piece', '{}', false, null, null),
  (113, 'Poires', 'fruits_legumes', 'piece', '{}', false, null, null),
  (114, 'Raisin', 'fruits_legumes', 'piece', '{"grappe de raisin"}', false, null, null),
  (115, 'Betteraves cuites', 'fruits_legumes', 'piece', '{}', false, null, null),
  (116, 'Endives', 'fruits_legumes', 'piece', '{}', false, null, null),
  (117, 'Mâche', 'fruits_legumes', 'piece', '{}', false, null, null),
  (118, 'Poireaux', 'fruits_legumes', 'piece', '{}', false, null, null),
  (119, 'Brioche', 'boulangerie', 'piece', '{}', false, null, null),
  (120, 'Croissants', 'boulangerie', 'piece', '{}', false, null, null),
  (121, 'Pain', 'boulangerie', 'piece', '{"pain frais"}', false, null, null),
  (122, 'Pains au chocolat', 'boulangerie', 'piece', '{"chocolatines"}', false, null, null),
  (123, 'Beurre demi-sel', 'cremerie', 'piece', '{}', false, null, null),
  (124, 'Camembert', 'cremerie', 'piece', '{}', false, null, null),
  (125, 'Comté', 'cremerie', 'piece', '{}', false, null, null),
  (126, 'Crèmes dessert', 'cremerie', 'piece', '{"crème dessert"}', false, null, null),
  (127, 'Emmental', 'cremerie', 'piece', '{}', false, null, null),
  (128, 'Fromage blanc', 'cremerie', 'piece', '{}', false, null, null),
  (129, 'Petits-suisses', 'cremerie', 'piece', '{"petits suisses"}', false, null, null),
  (130, 'Yaourts aux fruits', 'cremerie', 'piece', '{}', false, null, null),
  (131, 'Biscottes', 'epicerie', 'piece', '{}', false, null, null),
  (132, 'Biscuits', 'epicerie', 'piece', '{"gâteaux secs"}', false, null, null),
  (133, 'Café', 'epicerie', 'piece', '{"café moulu", "capsules de café", "dosettes de café"}', false, null, null),
  (134, 'Céréales', 'epicerie', 'piece', '{}', false, null, null),
  (135, 'Chips', 'epicerie', 'piece', '{}', false, null, null),
  (136, 'Chocolat au lait', 'epicerie', 'piece', '{}', false, null, null),
  (137, 'Chocolat en poudre', 'epicerie', 'piece', '{"cacao en poudre"}', false, null, null),
  (138, 'Chocolat noir', 'epicerie', 'piece', '{"chocolat pâtissier"}', false, null, null),
  (139, 'Ketchup', 'epicerie', 'piece', '{}', false, null, null),
  (140, 'Lentilles', 'epicerie', 'piece', '{}', false, null, null),
  (141, 'Pâte à tartiner', 'epicerie', 'piece', '{}', false, null, null),
  (142, 'Purée en flocons', 'epicerie', 'piece', '{}', false, null, null),
  (143, 'Sauce soja', 'epicerie', 'piece', '{}', false, null, null),
  (144, 'Semoule', 'epicerie', 'piece', '{"couscous"}', false, null, null),
  (145, 'Thé', 'epicerie', 'piece', '{"sachets de thé"}', false, null, null),
  (146, 'Bouillon cube', 'epicerie', 'piece', '{"cubes de bouillon", "bouillon"}', true, null, null),
  (147, 'Vinaigre balsamique', 'epicerie', 'piece', '{}', true, null, null),
  (148, 'Glaces', 'surgeles', 'piece', '{"glace", "crèmes glacées"}', false, null, null),
  (149, 'Petits pois surgelés', 'surgeles', 'piece', '{"petits pois"}', false, null, null),
  (150, 'Pizzas surgelées', 'surgeles', 'piece', '{"pizza"}', false, null, null),
  (151, 'Poisson pané', 'surgeles', 'piece', '{"bâtonnets de poisson", "poissons panés"}', false, null, null),
  (152, 'Bière', 'boissons', 'piece', '{"bières"}', false, null, null),
  (153, 'Eau gazeuse', 'boissons', 'piece', '{"eau pétillante"}', false, null, null),
  (154, 'Eau minérale', 'boissons', 'piece', '{"eau", "bouteilles d''eau"}', false, null, null),
  (155, 'Jus d''orange', 'boissons', 'piece', '{}', false, null, null),
  (156, 'Jus de pomme', 'boissons', 'piece', '{}', false, null, null),
  (157, 'Sirop', 'boissons', 'piece', '{"sirop de grenadine", "sirop de menthe"}', false, null, null),
  (158, 'Vin rouge', 'boissons', 'piece', '{"vin"}', false, null, null),
  (159, 'Dentifrice', 'autre', 'piece', '{}', false, null, null),
  (160, 'Éponges', 'autre', 'piece', '{}', false, null, null),
  (161, 'Essuie-tout', 'autre', 'piece', '{"sopalin"}', false, null, null),
  (162, 'Film alimentaire', 'autre', 'piece', '{}', false, null, null),
  (163, 'Gel douche', 'autre', 'piece', '{}', false, null, null),
  (164, 'Lessive', 'autre', 'piece', '{}', false, null, null),
  (165, 'Liquide vaisselle', 'autre', 'piece', '{}', false, null, null),
  (166, 'Mouchoirs', 'autre', 'piece', '{}', false, null, null),
  (167, 'Papier aluminium', 'autre', 'piece', '{"papier alu"}', false, null, null),
  (168, 'Papier toilette', 'autre', 'piece', '{"pq"}', false, null, null),
  (169, 'Sacs poubelle', 'autre', 'piece', '{}', false, null, null),
  (170, 'Shampooing', 'autre', 'piece', '{"shampoing"}', false, null, null),
  (171, 'Tablettes lave-vaisselle', 'autre', 'piece', '{"pastilles lave-vaisselle"}', false, null, null)
) as item (n, name, aisle, unit, aliases, pantry, piece_grams, grams_per_ml);

-- ─── Rattacher les lignes existantes ────────────────────────────────────────
-- Catalogue et recettes des foyers ; un nom inconnu crée un ingrédient de son foyer.
update public.recipe_ingredients ri
set ingredient_id = private.match_ingredient(ri.household_id, ri.name, ri.aisle, ri.unit)
where ri.ingredient_id is null;
