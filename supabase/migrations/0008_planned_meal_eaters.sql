-- Plusieurs plats sur un même repas : chaque présent mange un seul plat par repas.
-- Mettre un membre sur un plat le retire des autres plats du même repas ; un plat qui n'a plus
-- personne disparaît. Retirer un plat : un simple delete, sous la RLS existante.

-- ─── Poser les mangeurs d'un plat ───────────────────────────────────────────
-- Les autres plats du repas perdent ces mangeurs (ceux qui n'ont plus personne disparaissent),
-- puis le plat les reçoit et se verrouille (un choix fait à la main). En une transaction ;
-- la RLS s'applique (un plat d'un autre foyer est introuvable).
create function public.set_planned_meal_eaters(target_card_id uuid, eater_ids uuid[])
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

  delete from public.planned_meals p
  where p.week_plan_id = card.week_plan_id
    and p.day = card.day
    and p.meal_type = card.meal_type
    and p.id <> card.id
    and p.member_ids <@ eaters;

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
    and p.member_ids && eaters;

  update public.planned_meals p
  set member_ids = eaters,
      locked = true
  where p.id = card.id;
end;
$$;
revoke all on function public.set_planned_meal_eaters(uuid, uuid[]) from public, anon;
grant execute on function public.set_planned_meal_eaters(uuid, uuid[]) to authenticated;

-- ─── Ajouter un plat pour certains membres ──────────────────────────────────
-- Crée la semaine au besoin, ajoute le plat (verrouillé) après ceux du repas, et y met
-- `eater_ids`, qui quittent leur plat précédent. Rend l'id du nouveau plat.
create function public.add_planned_meal(
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
revoke all on function public.add_planned_meal(uuid, date, smallint, public.meal_type, uuid, uuid[]) from public, anon;
grant execute on function public.add_planned_meal(uuid, date, smallint, public.meal_type, uuid, uuid[]) to authenticated;
