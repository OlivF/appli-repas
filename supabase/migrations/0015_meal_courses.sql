-- Desserts, fruits, fromages : autant qu'on veut par repas.
-- Chaque recette a une sorte (recipes.course) : un plat (main, par défaut), ou un « plat léger » :
-- entrée, dessert, fruit, fromage, laitage. La règle « chaque présent mange un seul plat par
-- repas » ne vaut que pour les plats ; les plats légers sont illimités (une même recette une seule
-- fois par repas : on fusionne ses mangeurs) et la proposition automatique n'y touche jamais.
-- Recette légère : un ingrédient, une portion (« Yaourt nature » = 1 yaourt, « Comté » = 30 g).

-- ─── La sorte ───────────────────────────────────────────────────────────────
create type public.course as enum ('starter', 'main', 'dessert', 'fruit', 'cheese', 'dairy');

alter table public.recipes
  add column course public.course not null default 'main',
  -- Élément principal et « Les basiques » sont réservés aux plats.
  add constraint recipes_extra_has_no_base check (course = 'main' or (base is null and not basic));

comment on column public.recipes.course is
  'Sorte : main (plat), starter (entrée), dessert, fruit, cheese (fromage), dairy (laitage)';

-- Un plat léger : tout ce qui n'est pas un plat. Une recette inconnue n'en est pas un.
create function private.is_extra_recipe(target_recipe_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r where r.id = target_recipe_id and r.course <> 'main'
  );
$$;
revoke all on function private.is_extra_recipe(uuid) from public, anon;
grant execute on function private.is_extra_recipe(uuid) to authenticated;

-- ─── Enregistrer une recette ────────────────────────────────────────────────
-- Comme dans 0006, plus course (défaut main) ; hors plat, ni base ni basique.
-- recipe : {title, description, photo_url, meal_types, servings, prep_minutes,
--           cook_minutes, diets, steps, batch_friendly, batch_notes, kid_friendly,
--           base, basic, course}
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
  fields.course := coalesce(fields.course, 'main');
  fields.base := case when fields.course = 'main' then nullif(btrim(fields.base), '') end;
  fields.basic := fields.course = 'main' and coalesce(fields.basic, false);

  if target_recipe_id is null then
    insert into public.recipes (
      household_id, title, description, photo_url, meal_types, servings, prep_minutes,
      cook_minutes, diets, steps, batch_friendly, batch_notes, kid_friendly, base, basic, course
    ) values (
      target_household_id, fields.title, fields.description, fields.photo_url,
      fields.meal_types, fields.servings, coalesce(fields.prep_minutes, 0),
      coalesce(fields.cook_minutes, 0), coalesce(fields.diets, '{}'), coalesce(fields.steps, '{}'),
      coalesce(fields.batch_friendly, false), fields.batch_notes,
      coalesce(fields.kid_friendly, false), fields.base, fields.basic, fields.course
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
        basic = fields.basic,
        course = fields.course
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
-- Comme dans 0009, plus course.
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
    base, basic, course
  )
  select target_household_id, r.id, r.title, r.description, r.photo_url, r.meal_types,
         r.servings, r.prep_minutes, r.cook_minutes, r.diets, r.steps, r.batch_friendly,
         r.batch_notes, r.kid_friendly, r.base, r.basic, r.course
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

-- ─── Poser les mangeurs d'une carte ─────────────────────────────────────────
-- Comme dans 0008 pour un plat, mais l'exclusivité ne touche que les autres plats du repas (un
-- yaourt ne perd jamais ses mangeurs parce qu'on change qui mange le gratin). Sur un plat léger,
-- on pose ses mangeurs, sans toucher aux autres cartes ni au verrou.
create or replace function public.set_planned_meal_eaters(target_card_id uuid, eater_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  card public.planned_meals;
  eaters uuid[] := array_remove(coalesce(eater_ids, '{}'), null);
begin
  if cardinality(eaters) = 0 then
    raise exception 'Un plat se mange par au moins une personne' using errcode = 'check_violation';
  end if;

  select * into card from public.planned_meals p where p.id = target_card_id;
  if card.id is null then
    raise exception 'Plat introuvable' using errcode = 'no_data_found';
  end if;

  if private.is_extra_recipe(card.recipe_id) then
    update public.planned_meals p set member_ids = eaters where p.id = card.id;
    return;
  end if;

  delete from public.planned_meals p
  where p.week_plan_id = card.week_plan_id
    and p.day = card.day
    and p.meal_type = card.meal_type
    and p.id <> card.id
    and p.member_ids <@ eaters
    and not private.is_extra_recipe(p.recipe_id);

  update public.planned_meals p
  set member_ids = array(
    select eater.id
    from unnest(p.member_ids) with ordinality as eater (id, n)
    where eater.id <> all (eaters)
    order by eater.n
  )
  where p.week_plan_id = card.week_plan_id
    and p.day = card.day
    and p.meal_type = card.meal_type
    and p.id <> card.id
    and p.member_ids && eaters
    and not private.is_extra_recipe(p.recipe_id);

  update public.planned_meals p
  set member_ids = eaters,
      locked = true
  where p.id = card.id;
end;
$$;

-- ─── Ajouter un plat pour certains membres ──────────────────────────────────
-- Comme dans 0008 (l'exclusivité, via set_planned_meal_eaters, ne touche que les plats). Un plat
-- léger s'ajoute avec add_planned_extras, qui fusionne au lieu de créer un doublon.
create or replace function public.add_planned_meal(
  target_household_id uuid,
  target_week_start date,
  target_day smallint,
  target_meal_type public.meal_type,
  target_recipe_id uuid,
  eater_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan_id uuid;
  new_id uuid;
begin
  if cardinality(array_remove(coalesce(eater_ids, '{}'), null)) = 0 then
    raise exception 'Un plat se mange par au moins une personne' using errcode = 'check_violation';
  end if;
  if not private.is_household_member(target_household_id) then
    raise exception 'Ce foyer n''est pas le tien' using errcode = 'insufficient_privilege';
  end if;
  if private.is_extra_recipe(target_recipe_id) then
    raise exception 'Un dessert, un fruit ou une entrée s''ajoute avec add_planned_extras'
      using errcode = 'check_violation';
  end if;

  insert into public.week_plans (household_id, week_start)
  values (target_household_id, target_week_start)
  on conflict (household_id, week_start) do nothing;

  select w.id into plan_id
  from public.week_plans w
  where w.household_id = target_household_id
    and w.week_start = target_week_start;

  insert into public.planned_meals (week_plan_id, day, meal_type, position, recipe_id, member_ids, locked)
  select plan_id, target_day, target_meal_type,
         coalesce(max(p.position) + 1, 0), target_recipe_id, eater_ids, true
  from public.planned_meals p
  where p.week_plan_id = plan_id
    and p.day = target_day
    and p.meal_type = target_meal_type
  returning id into new_id;

  perform public.set_planned_meal_eaters(new_id, eater_ids);
  return new_id;
end;
$$;

-- ─── Ajouter des plats légers ───────────────────────────────────────────────
-- Crée la semaine au besoin. Pour chaque élément, dans l'ordre : si la recette est déjà au repas,
-- ses mangeurs fusionnent (union, dans l'ordre) ; sinon une carte (non verrouillée : le verrou ne
-- sert pas aux plats légers) se pose après celles du repas. Un plat est refusé. En une
-- transaction ; la RLS s'applique. Rend les cartes créées ou modifiées.
-- items : [{day, meal_type, recipe_id, member_ids}]
create function public.add_planned_extras(target_household_id uuid, target_week_start date, items jsonb)
returns setof public.planned_meals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan_id uuid;
  item record;
  existing_id uuid;
  saved public.planned_meals;
begin
  if not private.is_household_member(target_household_id) then
    raise exception 'Ce foyer n''est pas le tien' using errcode = 'insufficient_privilege';
  end if;

  insert into public.week_plans (household_id, week_start)
  values (target_household_id, target_week_start)
  on conflict (household_id, week_start) do nothing;

  select w.id into plan_id
  from public.week_plans w
  where w.household_id = target_household_id
    and w.week_start = target_week_start;

  for item in
    select (entry.value ->> 'day')::smallint as day,
           (entry.value ->> 'meal_type')::public.meal_type as meal_type,
           (entry.value ->> 'recipe_id')::uuid as recipe_id,
           array(
             select eater.id::uuid
             from jsonb_array_elements_text(entry.value -> 'member_ids') with ordinality as eater (id, n)
             where eater.id is not null
             order by eater.n
           ) as member_ids
    from jsonb_array_elements(coalesce(items, '[]')) with ordinality as entry (value, n)
    order by entry.n
  loop
    if cardinality(item.member_ids) = 0 then
      raise exception 'Un plat se mange par au moins une personne' using errcode = 'check_violation';
    end if;
    if not private.is_extra_recipe(item.recipe_id) then
      raise exception 'Seuls les entrées, desserts, fruits, fromages et laitages s''ajoutent ici'
        using errcode = 'check_violation';
    end if;

    select p.id into existing_id
    from public.planned_meals p
    where p.week_plan_id = plan_id
      and p.day = item.day
      and p.meal_type = item.meal_type
      and p.recipe_id = item.recipe_id
    order by p.position
    limit 1;

    if existing_id is not null then
      -- Le trigger de cohérence retire les doublons en gardant le premier.
      update public.planned_meals p
      set member_ids = p.member_ids || item.member_ids
      where p.id = existing_id
      returning * into saved;
    else
      insert into public.planned_meals (week_plan_id, day, meal_type, position, recipe_id, member_ids)
      select plan_id, item.day, item.meal_type, coalesce(max(p.position) + 1, 0), item.recipe_id, item.member_ids
      from public.planned_meals p
      where p.week_plan_id = plan_id
        and p.day = item.day
        and p.meal_type = item.meal_type
      returning * into saved;
    end if;

    return next saved;
  end loop;
end;
$$;
revoke all on function public.add_planned_extras(uuid, date, jsonb) from public, anon;
grant execute on function public.add_planned_extras(uuid, date, jsonb) to authenticated;

-- ─── Enregistrer une proposition ────────────────────────────────────────────
-- Comme dans 0005, mais seuls les plats non verrouillés sont remplacés : les plats légers restent.
-- Une carte proposée qui n'est pas un plat est refusée.
create or replace function public.save_week_proposal(
  target_household_id uuid,
  target_week_start date,
  new_seed integer,
  cards jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan_id uuid;
begin
  if exists (
    select 1
    from jsonb_array_elements(coalesce(cards, '[]')) as card
    where private.is_extra_recipe((card ->> 'recipe_id')::uuid)
  ) then
    raise exception 'La proposition ne pose que des plats' using errcode = 'check_violation';
  end if;

  insert into public.week_plans (household_id, week_start, seed)
  values (target_household_id, target_week_start, new_seed)
  on conflict (household_id, week_start) do update set seed = excluded.seed
  returning id into plan_id;

  delete from public.planned_meals p
  where p.week_plan_id = plan_id
    and not p.locked
    and not private.is_extra_recipe(p.recipe_id);

  insert into public.planned_meals (week_plan_id, day, meal_type, position, recipe_id, member_ids)
  select plan_id,
         (card ->> 'day')::smallint,
         (card ->> 'meal_type')::public.meal_type,
         coalesce((card ->> 'position')::smallint, 0),
         (card ->> 'recipe_id')::uuid,
         array(
           select eater.id::uuid
           from jsonb_array_elements_text(card -> 'member_ids') with ordinality as eater (id, n)
           order by eater.n
         )
  from jsonb_array_elements(coalesce(cards, '[]')) as card;

  return plan_id;
end;
$$;

-- ─── Échanger deux plats ────────────────────────────────────────────────────
-- Comme dans 0005 ; refusé aussi (P0001) si l'une des cartes est un plat léger : il reste au repas.
create or replace function public.swap_planned_meals(first_id uuid, second_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  first_recipe uuid;
  second_recipe uuid;
begin
  select p.recipe_id into first_recipe
  from public.planned_meals p
  where p.id = first_id and not p.locked and not private.is_extra_recipe(p.recipe_id);

  select p.recipe_id into second_recipe
  from public.planned_meals p
  where p.id = second_id and not p.locked and not private.is_extra_recipe(p.recipe_id);

  if first_recipe is null or second_recipe is null or first_id = second_id then
    raise exception 'Ces cartes ne peuvent pas être échangées';
  end if;

  update public.planned_meals p
  set recipe_id = case when p.id = first_id then second_recipe else first_recipe end
  where p.id in (first_id, second_id);
end;
$$;

-- ─── Référentiel commun ─────────────────────────────────────────────────────
-- Deux produits des recettes légères (recettes-legeres.json), mêmes identifiants fixes que 0009.
insert into public.ingredients (id, household_id, name, aisle, shopping_unit, aliases, pantry, piece_grams, grams_per_ml, shelf_life_days)
select ('1d9e0000-0000-4000-8000-' || lpad(item.n::text, 12, '0'))::uuid, null, item.name,
       item.aisle::public.grocery_aisle, item.unit::public.shopping_unit, item.aliases, false,
       item.piece_grams, null, item.days
from (values
  (172, 'Yaourt à la grecque', 'cremerie', 'g', '{"yaourt grec", "yaourt grec nature"}'::text[], null::numeric, 14),
  (173, 'Fromage de chèvre', 'cremerie', 'piece', '{"bûche de chèvre", "chèvre"}', 180, 10)
) as item (n, name, aisle, unit, aliases, piece_grams, days);

-- Le poids d'une pièce, là où une recette légère compte en grammes ce qu'on achète à la pièce.
update public.ingredients i
set piece_grams = item.grams
from (values
  (108, 250), -- Fraises : la barquette
  (114, 500), -- Raisin : la grappe
  (124, 250), -- Camembert
  (125, 250), -- Comté : le morceau
  (127, 250), -- Emmental : le morceau
  (128, 500), -- Fromage blanc : le pot
  (138, 100)  -- Chocolat noir : la tablette
) as item (n, grams)
where i.id = ('1d9e0000-0000-4000-8000-' || lpad(item.n::text, 12, '0'))::uuid
  and i.piece_grams is null;
