-- Étape 2 : planning de la semaine. Une semaine (week_plans) par foyer et par lundi ;
-- chaque repas d'un créneau porte une ou plusieurs cartes (planned_meals) : une recette,
-- les membres qui la mangent, et un verrou que « Relancer » respecte.

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table public.week_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  -- Graine de la dernière proposition : « Relancer » l'augmente pour proposer autre chose.
  seed integer not null default 0,
  created_at timestamptz not null default now(),
  unique (household_id, week_start)
);
comment on column public.week_plans.week_start is 'Lundi de la semaine';

create table public.planned_meals (
  id uuid primary key default gen_random_uuid(),
  -- Recopié de la semaine par trigger : sert à la RLS.
  household_id uuid not null references public.households (id) on delete cascade,
  week_plan_id uuid not null references public.week_plans (id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  meal_type public.meal_type not null,
  -- Ordre des cartes dans le créneau (plat pour tous, puis plat à part).
  position smallint not null default 0 check (position >= 0),
  -- Une recette supprimée fait disparaître ses cartes.
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  member_ids uuid[] not null check (cardinality(member_ids) > 0),
  locked boolean not null default false,
  created_at timestamptz not null default now()
);
comment on column public.planned_meals.day is '0 = lundi … 6 = dimanche';
comment on column public.planned_meals.member_ids is 'Membres qui mangent ce plat (members.id du même foyer)';
create index planned_meals_week_plan_idx on public.planned_meals (week_plan_id, day, meal_type, position);
create index planned_meals_recipe_id_idx on public.planned_meals (recipe_id);
create index planned_meals_household_id_idx on public.planned_meals (household_id);

-- ─── Cohérence ──────────────────────────────────────────────────────────────
-- Une carte prend le foyer de sa semaine ; sa recette est au catalogue ou au foyer ;
-- ses membres sont du foyer, sans doublon (dans l'ordre donné).
create function private.check_planned_meal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select wp.household_id into new.household_id
  from public.week_plans wp
  where wp.id = new.week_plan_id;
  if new.household_id is null then
    raise exception 'Semaine introuvable' using errcode = 'foreign_key_violation';
  end if;

  if not exists (
    select 1
    from public.recipes r
    where r.id = new.recipe_id
      and (r.household_id is null or r.household_id = new.household_id)
  ) then
    raise exception 'Cette recette n''est ni au catalogue ni dans ce foyer'
      using errcode = 'foreign_key_violation';
  end if;

  new.member_ids := array(
    select member.id
    from unnest(new.member_ids) with ordinality as member (id, n)
    group by member.id
    order by min(member.n)
  );

  if exists (
    select 1
    from unnest(new.member_ids) as eater (id)
    where not exists (
      select 1
      from public.members m
      where m.id = eater.id
        and m.household_id = new.household_id
    )
  ) then
    raise exception 'Une carte ne peut contenir que des membres du foyer'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create trigger planned_meals_check
  before insert or update of household_id, week_plan_id, recipe_id, member_ids on public.planned_meals
  for each row execute function private.check_planned_meal();

-- Un membre supprimé quitte ses cartes ; une carte devenue vide disparaît.
create function private.remove_member_from_planned_meals()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.planned_meals
  where household_id = old.household_id
    and member_ids <@ array[old.id];

  update public.planned_meals
  set member_ids = array_remove(member_ids, old.id)
  where household_id = old.household_id
    and old.id = any (member_ids);

  return old;
end;
$$;

create trigger members_remove_from_planned_meals
  after delete on public.members
  for each row execute function private.remove_member_from_planned_meals();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.week_plans enable row level security;
alter table public.planned_meals enable row level security;

revoke all on public.week_plans, public.planned_meals from anon;

create policy "Users manage week plans of their households" on public.week_plans
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Users manage planned meals of their households" on public.planned_meals
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Enregistrer une proposition ────────────────────────────────────────────
-- Crée la semaine au besoin, enregistre la graine, remplace toutes les cartes non
-- verrouillées par `cards`, en une seule transaction. La RLS s'applique.
-- cards : [{day, meal_type, position, recipe_id, member_ids}]
create function public.save_week_proposal(
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
  insert into public.week_plans (household_id, week_start, seed)
  values (target_household_id, target_week_start, new_seed)
  on conflict (household_id, week_start) do update set seed = excluded.seed
  returning id into plan_id;

  delete from public.planned_meals p
  where p.week_plan_id = plan_id
    and not p.locked;

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
revoke all on function public.save_week_proposal(uuid, date, integer, jsonb) from public, anon;
grant execute on function public.save_week_proposal(uuid, date, integer, jsonb) to authenticated;

-- ─── Échanger deux cartes ───────────────────────────────────────────────────
-- Les recettes changent de place ; les mangeurs restent ceux du créneau.
-- Refusé (P0001) si l'une des cartes est verrouillée ou invisible. La RLS s'applique.
create function public.swap_planned_meals(first_id uuid, second_id uuid)
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
  where p.id = first_id and not p.locked;

  select p.recipe_id into second_recipe
  from public.planned_meals p
  where p.id = second_id and not p.locked;

  if first_recipe is null or second_recipe is null or first_id = second_id then
    raise exception 'Ces cartes ne peuvent pas être échangées';
  end if;

  update public.planned_meals p
  set recipe_id = case when p.id = first_id then second_recipe else first_recipe end
  where p.id in (first_id, second_id);
end;
$$;
revoke all on function public.swap_planned_meals(uuid, uuid) from public, anon;
grant execute on function public.swap_planned_meals(uuid, uuid) to authenticated;

-- ─── Copier une recette du catalogue ────────────────────────────────────────
-- Comme dans 0002, plus : les cartes du foyer passent de l'originale à la copie.
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

  update public.planned_meals p
  set recipe_id = copy_id
  where p.household_id = target_household_id
    and p.recipe_id = catalog_recipe_id;

  return copy_id;
end;
$$;
