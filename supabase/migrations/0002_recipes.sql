-- Étape 2 : recettes, ingrédients, favoris et membres exclus.
-- Une recette sans foyer (household_id null) appartient au catalogue commun :
-- tout compte connecté la lit, personne ne la modifie ; un foyer peut la copier.

-- ─── Types ──────────────────────────────────────────────────────────────────
-- cas = cuillère à soupe, cac = cuillère à café.
create type public.ingredient_unit as enum ('g', 'kg', 'ml', 'l', 'piece', 'cas', 'cac');
create type public.grocery_aisle as enum (
  'fruits_legumes', 'boucherie', 'poissonnerie', 'cremerie', 'epicerie',
  'surgeles', 'boulangerie', 'boissons', 'autre'
);

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  -- Recette du catalogue dont celle-ci est la copie personnalisée.
  source_recipe_id uuid references public.recipes (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (char_length(description) <= 300),
  photo_url text check (photo_url ~ '^https?://' and char_length(photo_url) <= 2000),
  meal_types public.meal_type[] not null check (cardinality(meal_types) > 0),
  servings smallint not null check (servings between 1 and 50),
  prep_minutes smallint not null default 0 check (prep_minutes between 0 and 1440),
  cook_minutes smallint not null default 0 check (cook_minutes between 0 and 1440),
  diets public.diet[] not null default '{}',
  steps text[] not null default '{}',
  batch_friendly boolean not null default false,
  batch_notes text check (char_length(batch_notes) <= 1000),
  kid_friendly boolean not null default false,
  created_at timestamptz not null default now(),
  -- Une seule copie d'une même recette par foyer ; le catalogue ne copie pas.
  unique (household_id, source_recipe_id),
  check (source_recipe_id is null or household_id is not null)
);
comment on column public.recipes.household_id is 'null = recette du catalogue commun';
comment on column public.recipes.servings is 'Nombre de personnes pour les quantités saisies';
create index recipes_household_id_idx on public.recipes (household_id);
create index recipes_source_recipe_id_idx on public.recipes (source_recipe_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  -- Recopié de la recette par trigger (null pour le catalogue) : sert à la RLS.
  household_id uuid references public.households (id) on delete cascade,
  position smallint not null default 0,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  quantity numeric(10, 3) check (quantity > 0),
  unit public.ingredient_unit,
  aisle public.grocery_aisle not null default 'autre',
  -- « Sel, poivre » : ni quantité ni unité.
  check ((quantity is null) = (unit is null))
);
create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_ingredients_household_id_idx on public.recipe_ingredients (household_id);

create table public.recipe_favorites (
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, recipe_id)
);
create index recipe_favorites_recipe_id_idx on public.recipe_favorites (recipe_id);

-- Un membre précis qui n'aime pas, ou ne mange pas, cette recette.
create table public.recipe_member_exclusions (
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, member_id)
);
create index recipe_member_exclusions_household_id_idx on public.recipe_member_exclusions (household_id);
create index recipe_member_exclusions_member_id_idx on public.recipe_member_exclusions (member_id);

-- ─── Cohérence ──────────────────────────────────────────────────────────────
-- Un ingrédient appartient au foyer de sa recette (et au catalogue avec elle).
create function private.set_ingredient_household()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select r.household_id into new.household_id
  from public.recipes r
  where r.id = new.recipe_id;
  return new;
end;
$$;

create trigger recipe_ingredients_set_household
  before insert or update of recipe_id, household_id on public.recipe_ingredients
  for each row execute function private.set_ingredient_household();

-- Favoris et exclus : la recette est au catalogue ou au foyer ; le membre est du foyer.
create function private.check_recipe_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.recipes r
    where r.id = new.recipe_id
      and (r.household_id is null or r.household_id = new.household_id)
  ) then
    raise exception 'Cette recette n''est ni au catalogue ni dans ce foyer'
      using errcode = 'foreign_key_violation';
  end if;

  -- Deux if imbriqués : new.member_id n'existe que sur la table des exclus.
  if tg_table_name = 'recipe_member_exclusions' then
    if not exists (
      select 1
      from public.members m
      where m.id = new.member_id
        and m.household_id = new.household_id
    ) then
      raise exception 'On ne peut exclure qu''un membre du foyer'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger recipe_favorites_check_link
  before insert or update on public.recipe_favorites
  for each row execute function private.check_recipe_link();

create trigger recipe_member_exclusions_check_link
  before insert or update on public.recipe_member_exclusions
  for each row execute function private.check_recipe_link();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_favorites enable row level security;
alter table public.recipe_member_exclusions enable row level security;

revoke all on public.recipes, public.recipe_ingredients, public.recipe_favorites,
  public.recipe_member_exclusions
  from anon;

-- Lecture : le catalogue, plus les recettes de ses foyers.
create policy "Users read the catalog and their recipes" on public.recipes
  for select to authenticated
  using (household_id is null or private.is_household_member(household_id));

-- Écriture : seulement dans ses foyers (is_household_member(null) est faux : catalogue intouchable).
create policy "Users manage their recipes" on public.recipes
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Users read ingredients of the catalog and of their recipes" on public.recipe_ingredients
  for select to authenticated
  using (household_id is null or private.is_household_member(household_id));

create policy "Users manage ingredients of their recipes" on public.recipe_ingredients
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Users manage favorites of their households" on public.recipe_favorites
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Users manage exclusions of their households" on public.recipe_member_exclusions
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Ingrédients connus (autocomplétion) ────────────────────────────────────
-- Un nom par ingrédient, avec son rayon et son unité habituelle : ce que le foyer a choisi
-- passe avant le catalogue, une ligne avec unité avant « sel, poivre ».
create view public.known_ingredients
with (security_invoker = true)
as
select distinct on (lower(name)) name, aisle, unit
from public.recipe_ingredients
order by lower(name), (household_id is null), (unit is null), name;

revoke all on public.known_ingredients from anon;

-- ─── Enregistrer une recette ────────────────────────────────────────────────
-- Crée (sans target_recipe_id) ou met à jour une recette du foyer, et remplace ses
-- ingrédients et ses membres exclus, en une seule transaction. La RLS s'applique.
-- recipe : {title, description, photo_url, meal_types, servings, prep_minutes,
--           cook_minutes, diets, steps, batch_friendly, batch_notes, kid_friendly}
-- ingredients : [{name, quantity, unit, aisle}], dans l'ordre d'affichage.
create function public.save_recipe(
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

  if target_recipe_id is null then
    insert into public.recipes (
      household_id, title, description, photo_url, meal_types, servings, prep_minutes,
      cook_minutes, diets, steps, batch_friendly, batch_notes, kid_friendly
    ) values (
      target_household_id, fields.title, fields.description, fields.photo_url,
      fields.meal_types, fields.servings, coalesce(fields.prep_minutes, 0),
      coalesce(fields.cook_minutes, 0), coalesce(fields.diets, '{}'), coalesce(fields.steps, '{}'),
      coalesce(fields.batch_friendly, false), fields.batch_notes,
      coalesce(fields.kid_friendly, false)
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
        kid_friendly = coalesce(fields.kid_friendly, false)
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
revoke all on function public.save_recipe(uuid, jsonb, jsonb, uuid[], uuid) from public, anon;
grant execute on function public.save_recipe(uuid, jsonb, jsonb, uuid[], uuid) to authenticated;

-- ─── Copier une recette du catalogue ────────────────────────────────────────
-- Crée la copie personnalisable (ou rend celle qui existe déjà) et y déplace le favori
-- et les membres exclus que le foyer avait posés sur l'originale. La RLS s'applique.
create function public.copy_recipe(catalog_recipe_id uuid, target_household_id uuid)
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
    prep_minutes, cook_minutes, diets, steps, batch_friendly, batch_notes, kid_friendly
  )
  select target_household_id, r.id, r.title, r.description, r.photo_url, r.meal_types,
         r.servings, r.prep_minutes, r.cook_minutes, r.diets, r.steps, r.batch_friendly,
         r.batch_notes, r.kid_friendly
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

  return copy_id;
end;
$$;
revoke all on function public.copy_recipe(uuid, uuid) from public, anon;
grant execute on function public.copy_recipe(uuid, uuid) to authenticated;
