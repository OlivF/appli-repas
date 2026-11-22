-- Les repas d'une semaine : le réglage du foyer (meal_slots) reste le modèle de toutes les
-- semaines ; une semaine peut changer un repas (week_meal_overrides) : retirer un repas, en
-- ajouter un, ou changer qui est là. Seuls les repas touchés sont figés : si le foyer change
-- plus tard, les autres repas de la semaine suivent. Les plats suivent les présents.

-- ─── Table ──────────────────────────────────────────────────────────────────
create table public.week_meal_overrides (
  id uuid primary key default gen_random_uuid(),
  -- Recopié de la semaine par trigger : sert à la RLS.
  household_id uuid not null references public.households (id) on delete cascade,
  week_plan_id uuid not null references public.week_plans (id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  meal_type public.meal_type not null,
  -- Vide : pas de repas cette semaine.
  member_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (week_plan_id, day, meal_type)
);
comment on table public.week_meal_overrides is
  'Un repas changé pour une semaine : ses présents remplacent ceux du créneau du foyer';
comment on column public.week_meal_overrides.day is '0 = lundi … 6 = dimanche';
comment on column public.week_meal_overrides.member_ids is
  'Présents ce repas-là cette semaine (members.id du même foyer) ; vide = pas de repas';
create index week_meal_overrides_household_id_idx on public.week_meal_overrides (household_id);

-- ─── Cohérence ──────────────────────────────────────────────────────────────
-- Une exception prend le foyer de sa semaine ; ses membres sont du foyer, sans doublon (dans
-- l'ordre donné).
create function private.check_week_meal_override()
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

  new.member_ids := array(
    select member.id
    from unnest(coalesce(new.member_ids, '{}')) with ordinality as member (id, n)
    where member.id is not null
    group by member.id
    order by min(member.n)
  );

  if exists (
    select 1
    from unnest(new.member_ids) as present (id)
    where not exists (
      select 1
      from public.members m
      where m.id = present.id
        and m.household_id = new.household_id
    )
  ) then
    raise exception 'Un repas ne peut réunir que des membres du foyer'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create trigger week_meal_overrides_check
  before insert or update of household_id, week_plan_id, member_ids on public.week_meal_overrides
  for each row execute function private.check_week_meal_override();

-- Un membre supprimé quitte les exceptions. Celle où il était seul disparaît : la semaine retombe
-- sur le foyer, qui l'a perdu aussi (une suppression de membre n'invente pas « pas de repas »).
create function private.remove_member_from_week_meal_overrides()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.week_meal_overrides
  where household_id = old.household_id
    and member_ids = array[old.id];

  update public.week_meal_overrides
  set member_ids = array_remove(member_ids, old.id)
  where household_id = old.household_id
    and old.id = any (member_ids);

  return old;
end;
$$;

create trigger members_remove_from_week_meal_overrides
  after delete on public.members
  for each row execute function private.remove_member_from_week_meal_overrides();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.week_meal_overrides enable row level security;

revoke all on public.week_meal_overrides from anon;

create policy "Users manage week meal overrides of their households" on public.week_meal_overrides
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Les présents d'un repas, cette semaine ─────────────────────────────────
-- L'exception de la semaine si elle existe, sinon le créneau du foyer, sinon personne.
create function private.week_slot_members(plan_id uuid, target_day smallint, target_meal_type public.meal_type)
returns uuid[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select o.member_ids
     from public.week_meal_overrides o
     where o.week_plan_id = plan_id
       and o.day = target_day
       and o.meal_type = target_meal_type),
    (select s.member_ids
     from public.meal_slots s
     join public.week_plans w on w.household_id = s.household_id
     where w.id = plan_id
       and s.day = target_day
       and s.meal_type = target_meal_type),
    '{}'
  );
$$;
revoke all on function private.week_slot_members(uuid, smallint, public.meal_type) from public, anon;
grant execute on function private.week_slot_members(uuid, smallint, public.meal_type) to authenticated;

-- Les plats (et plats légers) d'un repas ne gardent que ses présents ; une carte qui n'a plus
-- personne disparaît.
create function private.trim_week_cards(plan_id uuid, target_day smallint, target_meal_type public.meal_type)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  present uuid[] := private.week_slot_members(plan_id, target_day, target_meal_type);
begin
  delete from public.planned_meals p
  where p.week_plan_id = plan_id
    and p.day = target_day
    and p.meal_type = target_meal_type
    and not (p.member_ids && present);

  update public.planned_meals p
  set member_ids = array(
    select eater.id
    from unnest(p.member_ids) with ordinality as eater (id, n)
    where eater.id = any (present)
    order by eater.n
  )
  where p.week_plan_id = plan_id
    and p.day = target_day
    and p.meal_type = target_meal_type
    and not (p.member_ids <@ present);
end;
$$;
revoke all on function private.trim_week_cards(uuid, smallint, public.meal_type) from public, anon;
grant execute on function private.trim_week_cards(uuid, smallint, public.meal_type) to authenticated;

-- ─── Changer un repas, pour une semaine ─────────────────────────────────────
-- Crée la semaine au besoin. Les présents du créneau du foyer (même ensemble) : l'exception
-- disparaît, on revient au réglage du foyer ; sinon elle est enregistrée (vide : pas de repas).
-- Puis les plats du repas suivent. La RLS s'applique.
create function public.set_week_meal(
  target_household_id uuid,
  target_week_start date,
  target_day smallint,
  target_meal_type public.meal_type,
  eater_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan_id uuid;
  home uuid[];
  eaters uuid[] := array_remove(coalesce(eater_ids, '{}'), null);
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

  select coalesce(
    (select s.member_ids
     from public.meal_slots s
     where s.household_id = target_household_id
       and s.day = target_day
       and s.meal_type = target_meal_type),
    '{}'
  ) into home;

  if home @> eaters and eaters @> home then
    delete from public.week_meal_overrides o
    where o.week_plan_id = plan_id
      and o.day = target_day
      and o.meal_type = target_meal_type;
  else
    insert into public.week_meal_overrides (week_plan_id, day, meal_type, member_ids)
    values (plan_id, target_day, target_meal_type, eaters)
    on conflict (week_plan_id, day, meal_type) do update set member_ids = excluded.member_ids;
  end if;

  perform private.trim_week_cards(plan_id, target_day, target_meal_type);
end;
$$;
revoke all on function public.set_week_meal(uuid, date, smallint, public.meal_type, uuid[]) from public, anon;
grant execute on function public.set_week_meal(uuid, date, smallint, public.meal_type, uuid[]) to authenticated;

-- Tous les repas de la semaine reprennent le réglage du foyer ; les plats des repas qui avaient
-- une exception suivent (un repas ajouté disparaît avec ses plats).
create function public.reset_week_meals(target_household_id uuid, target_week_start date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plan_id uuid;
  touched record;
begin
  if not private.is_household_member(target_household_id) then
    raise exception 'Ce foyer n''est pas le tien' using errcode = 'insufficient_privilege';
  end if;

  select w.id into plan_id
  from public.week_plans w
  where w.household_id = target_household_id
    and w.week_start = target_week_start;
  if plan_id is null then
    return;
  end if;

  for touched in
    delete from public.week_meal_overrides o
    where o.week_plan_id = plan_id
    returning o.day, o.meal_type
  loop
    perform private.trim_week_cards(plan_id, touched.day, touched.meal_type);
  end loop;
end;
$$;
revoke all on function public.reset_week_meals(uuid, date) from public, anon;
grant execute on function public.reset_week_meals(uuid, date) to authenticated;
