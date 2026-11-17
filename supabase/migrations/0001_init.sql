-- Étape 1 : foyers, comptes, membres et créneaux de repas, avec RLS par foyer.

-- ─── Types ──────────────────────────────────────────────────────────────────
create type public.meal_type as enum ('petit_dej', 'midi', 'soir', 'pique_nique');
create type public.appetite as enum ('normal', 'grand');
create type public.diet as enum ('keto', 'vegetarian', 'gluten_free', 'lactose_free');

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Comptes liés à un foyer (pour le partager entre conjoints).
create table public.household_users (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_users_user_id_idx on public.household_users (user_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 50),
  birth_year smallint not null check (birth_year between 1900 and 2100),
  diets public.diet[] not null default '{}',
  appetite public.appetite not null default 'normal',
  created_at timestamptz not null default now()
);
create index members_household_id_idx on public.members (household_id);

create table public.meal_slots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  meal_type public.meal_type not null,
  member_ids uuid[] not null check (cardinality(member_ids) > 0),
  created_at timestamptz not null default now(),
  unique (household_id, day, meal_type)
);
comment on column public.meal_slots.day is '0 = lundi … 6 = dimanche';
comment on column public.meal_slots.member_ids is 'Membres présents (members.id du même foyer)';

-- ─── Appartenance à un foyer ────────────────────────────────────────────────
-- Schéma non exposé par l'API : ces fonctions ne servent qu'aux politiques et triggers.
create schema private;
grant usage on schema private to authenticated;

-- security definer : lit household_users sans repasser par sa propre RLS (pas de récursion).
create function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_users hu
    where hu.household_id = target_household_id
      and hu.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_household_member(uuid) from public;
grant execute on function private.is_household_member(uuid) to authenticated;

-- ─── RLS : on ne voit que les foyers dont on est membre ─────────────────────
alter table public.households enable row level security;
alter table public.household_users enable row level security;
alter table public.members enable row level security;
alter table public.meal_slots enable row level security;

-- Aucun accès sans compte.
revoke all on public.households, public.household_users, public.members, public.meal_slots
  from anon;

-- La création passe par create_household() : on n'est pas encore membre du foyer qu'on crée.
create policy "Users read their households" on public.households
  for select to authenticated
  using (private.is_household_member(id));

create policy "Users update their households" on public.households
  for update to authenticated
  using (private.is_household_member(id))
  with check (private.is_household_member(id));

-- Lecture seule : les rattachements se font par fonction (création, invitations plus tard).
create policy "Users read accounts of their households" on public.household_users
  for select to authenticated
  using (private.is_household_member(household_id));

create policy "Users manage members of their households" on public.members
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Users manage meal slots of their households" on public.meal_slots
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Création d'un foyer ────────────────────────────────────────────────────
-- Crée le foyer et y rattache le compte connecté, en une seule opération.
create function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;

  insert into public.households (name)
  values (btrim(household_name))
  returning id into new_household_id;

  insert into public.household_users (household_id, user_id)
  values (new_household_id, (select auth.uid()));

  return new_household_id;
end;
$$;
revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

-- ─── Cohérence des créneaux ─────────────────────────────────────────────────
-- Un créneau ne liste que des membres de son foyer, sans doublon.
create function private.check_meal_slot_members()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.member_ids := array(select distinct unnest(new.member_ids));

  if exists (
    select 1
    from unnest(new.member_ids) as slot_member (id)
    where not exists (
      select 1
      from public.members m
      where m.id = slot_member.id
        and m.household_id = new.household_id
    )
  ) then
    raise exception 'Un créneau ne peut contenir que des membres du foyer'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create trigger meal_slots_check_members
  before insert or update of member_ids, household_id on public.meal_slots
  for each row execute function private.check_meal_slot_members();

-- Un membre supprimé quitte ses créneaux ; un créneau devenu vide disparaît.
create function private.remove_member_from_meal_slots()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.meal_slots
  where household_id = old.household_id
    and member_ids <@ array[old.id];

  update public.meal_slots
  set member_ids = array_remove(member_ids, old.id)
  where household_id = old.household_id
    and old.id = any (member_ids);

  return old;
end;
$$;

create trigger members_remove_from_meal_slots
  after delete on public.members
  for each row execute function private.remove_member_from_meal_slots();
