-- Étape 3 : la liste de courses d'une semaine, partagée par les comptes du foyer.
-- Calculée depuis le menu côté appli (lib/shopping.ts), enregistrée ici : ce qu'on coche, ce
-- qu'on a déjà, ce qu'on ajoute à la main. Jamais mise à jour toute seule : la signature du menu
-- dit seulement si elle est encore à jour.

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  -- Recopié de la semaine par trigger : sert à la RLS.
  household_id uuid not null references public.households (id) on delete cascade,
  week_plan_id uuid not null unique references public.week_plans (id) on delete cascade,
  -- Empreinte du menu (recettes et mangeurs) au moment du calcul.
  menu_signature text not null default '',
  updated_at timestamptz not null default now()
);
create index shopping_lists_household_id_idx on public.shopping_lists (household_id);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  -- Recopié de la liste par trigger : sert à la RLS.
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete set null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  -- Les morceaux de quantité, dans l'unité d'achat : [{quantity, unit}] (« 200 g + 2 c. à soupe »).
  amounts jsonb not null default '[]' check (jsonb_typeof(amounts) = 'array'),
  aisle public.grocery_aisle not null default 'autre',
  -- Produit du placard : à vérifier, sans quantité.
  pantry boolean not null default false,
  -- Pour quoi : [{recipeId, recipeTitle, day, mealType, eaters}].
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  checked boolean not null default false,
  -- « J'en ai déjà » : masqué, conservé à la mise à jour (servira au frigo).
  removed boolean not null default false,
  -- Produit du placard passé dans la liste (« Il n'en reste plus »).
  needed boolean not null default false,
  -- Quantité augmentée à la dernière mise à jour : la case a été décochée.
  quantity_changed boolean not null default false,
  -- Ajouté à la main : la mise à jour le garde tel quel.
  manual boolean not null default false,
  -- Quantité tapée à la main (« 2 », « 500 g », « 1 paquet »).
  quantity_text text check (char_length(quantity_text) <= 40),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index shopping_items_list_id_idx on public.shopping_items (list_id, position);
create index shopping_items_household_id_idx on public.shopping_items (household_id);
create index shopping_items_ingredient_id_idx on public.shopping_items (ingredient_id);

-- ─── Cohérence ──────────────────────────────────────────────────────────────
-- Une liste prend le foyer de sa semaine, un article celui de sa liste (invisibles sous la RLS
-- quand ils sont à un autre foyer : refusé).
create function private.set_shopping_household()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'shopping_lists' then
    select wp.household_id into new.household_id
    from public.week_plans wp
    where wp.id = new.week_plan_id;
    if new.household_id is null then
      raise exception 'Semaine introuvable' using errcode = 'foreign_key_violation';
    end if;
  else
    select l.household_id into new.household_id
    from public.shopping_lists l
    where l.id = new.list_id;
    if new.household_id is null then
      raise exception 'Liste introuvable' using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger shopping_lists_set_household
  before insert or update of household_id, week_plan_id on public.shopping_lists
  for each row execute function private.set_shopping_household();

create trigger shopping_items_set_household
  before insert or update of household_id, list_id on public.shopping_items
  for each row execute function private.set_shopping_household();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

revoke all on public.shopping_lists, public.shopping_items from anon;

create policy "Users manage shopping lists of their households" on public.shopping_lists
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Users manage shopping items of their households" on public.shopping_items
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Enregistrer la liste calculée ──────────────────────────────────────────
-- Crée la liste de la semaine au besoin, remplace ses articles calculés par `items` (déjà
-- fusionnés côté appli avec ce qui était coché), garde les articles ajoutés à la main, et note la
-- signature du menu. En une transaction ; la RLS s'applique. Rend l'id de la liste.
-- items : [{ingredient_id, label, amounts, aisle, pantry, sources, checked, removed, needed,
--           quantity_changed, position}]
create function public.sync_shopping_list(target_week_plan_id uuid, signature text, items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_list_id uuid;
begin
  insert into public.shopping_lists (week_plan_id, menu_signature)
  values (target_week_plan_id, coalesce(signature, ''))
  on conflict (week_plan_id) do update
    set menu_signature = excluded.menu_signature,
        updated_at = now()
  returning id into saved_list_id;

  delete from public.shopping_items i
  where i.list_id = saved_list_id
    and not i.manual;

  insert into public.shopping_items (
    list_id, ingredient_id, label, amounts, aisle, pantry, sources, checked, removed, needed,
    quantity_changed, position
  )
  select saved_list_id,
         (item ->> 'ingredient_id')::uuid,
         btrim(item ->> 'label'),
         coalesce(item -> 'amounts', '[]'),
         coalesce((item ->> 'aisle')::public.grocery_aisle, 'autre'),
         coalesce((item ->> 'pantry')::boolean, false),
         coalesce(item -> 'sources', '[]'),
         coalesce((item ->> 'checked')::boolean, false),
         coalesce((item ->> 'removed')::boolean, false),
         coalesce((item ->> 'needed')::boolean, false),
         coalesce((item ->> 'quantity_changed')::boolean, false),
         coalesce((item ->> 'position')::integer, 0)
  from jsonb_array_elements(coalesce(items, '[]')) as item;

  return saved_list_id;
end;
$$;
revoke all on function public.sync_shopping_list(uuid, text, jsonb) from public, anon;
grant execute on function public.sync_shopping_list(uuid, text, jsonb) to authenticated;

-- ─── Ajouter un article à la main ───────────────────────────────────────────
-- Trouvé dans le référentiel (nom ou alias) : son nom canonique et son rayon ; sinon le texte
-- tapé, au rayon « autre ». Toujours à acheter (jamais au placard), après les autres manuels.
create function public.add_shopping_item(target_list_id uuid, raw_label text, quantity_text text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean text := btrim(regexp_replace(coalesce(raw_label, ''), '\s+', ' ', 'g'));
  list public.shopping_lists;
  known public.ingredients;
  new_id uuid;
begin
  if clean = '' then
    raise exception 'Un article a un nom' using errcode = 'check_violation';
  end if;

  select * into list from public.shopping_lists l where l.id = target_list_id;
  if list.id is null then
    raise exception 'Liste introuvable' using errcode = 'no_data_found';
  end if;

  select * into known
  from public.ingredients i
  where i.id = private.find_ingredient(list.household_id, clean);

  insert into public.shopping_items (list_id, ingredient_id, label, aisle, manual, quantity_text, position)
  values (
    list.id,
    known.id,
    coalesce(known.name, clean),
    coalesce(known.aisle, 'autre'),
    true,
    nullif(btrim(coalesce(quantity_text, '')), ''),
    coalesce((select max(i.position) + 1 from public.shopping_items i where i.list_id = list.id and i.manual), 0)
  )
  returning id into new_id;

  return new_id;
end;
$$;
revoke all on function public.add_shopping_item(uuid, text, text) from public, anon;
grant execute on function public.add_shopping_item(uuid, text, text) to authenticated;
