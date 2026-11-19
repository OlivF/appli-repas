-- Recettes associées et basiques.
-- base : l'élément principal du plat (« Steak haché », « Poulet »…). Deux recettes de même base
--        (comparées sans accents ni majuscules, côté appli) s'associent : une seule cuisson, deux
--        accompagnements (des frites pour la famille, des haricots verts pour qui mange céto).
-- basic : la recette fait partie du panneau « Les basiques » de la semaine ; la proposition
--         automatique la laisse de côté.

alter table public.recipes
  add column base text check (base is null or char_length(btrim(base)) between 1 and 60),
  add column basic boolean not null default false;

comment on column public.recipes.base is 'Élément principal ; deux recettes de même base se cuisinent ensemble';
comment on column public.recipes.basic is 'Recette du panneau « Les basiques »';

-- ─── Enregistrer une recette ────────────────────────────────────────────────
-- Comme dans 0002, plus base (rognée, vide → null) et basic.
-- recipe : {title, description, photo_url, meal_types, servings, prep_minutes,
--           cook_minutes, diets, steps, batch_friendly, batch_notes, kid_friendly,
--           base, basic}
create or replace function public.save_recipe(
  target_household_id uuid,
  recipe jsonb,
  ingredients jsonb,
  excluded_member_ids uuid[],
  target_recipe_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  fields public.recipes;
  saved_id uuid;
begin
  fields := jsonb_populate_record(null::public.recipes, recipe);
  fields.base := nullif(btrim(fields.base), '');

  if target_recipe_id is null then
    insert into public.recipes (
      household_id, title, description, photo_url, meal_types, servings, prep_minutes,
      cook_minutes, diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic
    ) values (
      target_household_id, fields.title, fields.description, fields.photo_url,
      fields.meal_types, fields.servings, coalesce(fields.prep_minutes, 0),
      coalesce(fields.cook_minutes, 0), coalesce(fields.diets, '{}'), coalesce(fields.steps, '{}'),
      coalesce(fields.batch_friendly, false), fields.batch_notes,
      coalesce(fields.kid_friendly, false), fields.base, coalesce(fields.basic, false)
    )
    returning id into saved_id;
  else
    update public.recipes r
    set title = fields.title,
        description = fields.description,
        photo_url = fields.photo_url,
        meal_types = fields.meal_types,
        servings = fields.servings,
        prep_minutes = coalesce(fields.prep_minutes, 0),
        cook_minutes = coalesce(fields.cook_minutes, 0),
        diets = coalesce(fields.diets, '{}'),
        steps = coalesce(fields.steps, '{}'),
        batch_friendly = coalesce(fields.batch_friendly, false),
        batch_notes = fields.batch_notes,
        kid_friendly = coalesce(fields.kid_friendly, false),
        base = fields.base,
        basic = coalesce(fields.basic, false)
    where r.id = target_recipe_id
      and r.household_id = target_household_id
    returning r.id into saved_id;

    if saved_id is null then
      raise exception 'Recette introuvable' using errcode = 'no_data_found';
    end if;
  end if;

  delete from public.recipe_ingredients ri where ri.recipe_id = saved_id;

  insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
  select saved_id,
         (item.n - 1)::smallint,
         btrim(item.value ->> 'name'),
         (item.value ->> 'quantity')::numeric,
         (item.value ->> 'unit')::public.ingredient_unit,
         coalesce((item.value ->> 'aisle')::public.grocery_aisle, 'autre')
  from jsonb_array_elements(coalesce(ingredients, '[]')) with ordinality as item (value, n);

  delete from public.recipe_member_exclusions e
  where e.recipe_id = saved_id
    and e.household_id = target_household_id;

  insert into public.recipe_member_exclusions (household_id, recipe_id, member_id)
  select distinct target_household_id, saved_id, member_id
  from unnest(coalesce(excluded_member_ids, '{}')) as member_id;

  return saved_id;
end;
$$;

-- ─── Copier une recette du catalogue ────────────────────────────────────────
-- Comme dans 0005, plus base et basic.
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

  insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
  select copy_id, ri.position, ri.name, ri.quantity, ri.unit, ri.aisle
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

-- ─── Bases du catalogue 0003 ────────────────────────────────────────────────
-- Seulement quand c'est évident : une viande ou un poisson qui cuit à part de son
-- accompagnement. Les salades, wraps et taboulé au poulet (27, 30, 33) sont des midis à
-- emporter, pas la même cuisson ; le saumon fumé (32) et les boulettes (23) restent seuls.
update public.recipes
set base = case right(id::text, 2) when '22' then 'Saumon' else 'Poulet' end
where household_id is null
  and id in (
    'ca7a0000-0000-4000-8000-000000000015', -- Poulet rôti et pommes de terre
    'ca7a0000-0000-4000-8000-000000000021', -- Poulet à la crème et aux champignons
    'ca7a0000-0000-4000-8000-000000000022'  -- Saumon au four, beurre citronné et brocolis
  );

-- Les copies déjà faites de ces recettes : la copie remplace l'original dans le foyer, elle
-- garde donc son association.
update public.recipes copy
set base = source.base
from public.recipes source
where copy.source_recipe_id = source.id
  and copy.base is null
  and source.base is not null;
