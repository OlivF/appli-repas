-- Étape 3 ter : la liste de courses en direct entre les comptes du foyer (au drive, l'un coche,
-- l'autre le voit). Supabase Realtime diffuse les changements des tables de la publication
-- `supabase_realtime` ; chaque abonné ne reçoit que les lignes que sa RLS lui laisse lire
-- (private.is_household_member). L'écran s'abonne aux articles d'une liste (list_id) et à la
-- ligne de la liste. La semaine et le frigo restent sans direct.

alter publication supabase_realtime add table public.shopping_items, public.shopping_lists;

-- Une suppression d'article n'arrive pas aux abonnés filtrés par list_id : Postgres ne garde que
-- l'identifiant de la ligne effacée, et Realtime l'enverrait sinon, sans RLS, à tous les comptes
-- abonnés à la table. La liste concernée est donc « touchée » (updated_at) : ce changement-là
-- passe par la RLS, et l'écran recharge ses articles.
create function private.touch_lists_after_item_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shopping_lists l
  set updated_at = now()
  where l.id in (select distinct removed.list_id from removed);
  return null;
end;
$$;

revoke all on function private.touch_lists_after_item_delete() from public, anon, authenticated;

create trigger shopping_items_touch_list_after_delete
  after delete on public.shopping_items
  referencing old table as removed
  for each statement execute function private.touch_lists_after_item_delete();
