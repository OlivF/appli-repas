-- Étape 3 bis : « Ranger les courses ». Après le drive, les articles cochés entrent au frigo,
-- réservés à la liste de leur semaine (achetés pour ce menu-là) ; ils passent « déjà rangés » et
-- la proposition est traitée. En une transaction : une coupure ne laisse pas d'article à moitié
-- rangé, et une double touche (ou l'autre téléphone) ne range rien deux fois.

-- entries : [{item_id, quantity, best_before}] (quantité dans l'unité d'achat, ou null).
-- Rend le nombre d'articles rangés. La RLS s'applique.
create function public.store_groceries(target_list_id uuid, entries jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  list public.shopping_lists;
  stored_count integer;
begin
  select * into list
  from public.shopping_lists l
  where l.id = target_list_id
  for update;
  if list.id is null then
    raise exception 'Liste introuvable' using errcode = 'no_data_found';
  end if;

  with picked as (
    select i.id, i.ingredient_id, i.label,
           (entry ->> 'quantity')::numeric as quantity,
           (entry ->> 'best_before')::date as best_before
    from jsonb_array_elements(coalesce(entries, '[]')) as entry
    join public.shopping_items i on i.id = (entry ->> 'item_id')::uuid
    where i.list_id = list.id
      and not i.stored
  ),
  marked as (
    update public.shopping_items i
    set stored = true
    from picked
    where i.id = picked.id
    returning i.id
  )
  -- Une semaine déjà soldée n'a plus de bilan à venir : ce qu'on y range est libre.
  insert into public.fridge_items (household_id, ingredient_id, label, quantity, best_before, origin, reserved_list_id)
  select list.household_id, picked.ingredient_id, picked.label, picked.quantity, picked.best_before, 'shopping',
         case when list.settled_at is null then list.id end
  from picked
  join marked on marked.id = picked.id;
  get diagnostics stored_count = row_count;

  update public.shopping_lists l
  set stored_at = coalesce(l.stored_at, now())
  where l.id = list.id;

  return stored_count;
end;
$$;
revoke all on function public.store_groceries(uuid, jsonb) from public, anon;
grant execute on function public.store_groceries(uuid, jsonb) to authenticated;
