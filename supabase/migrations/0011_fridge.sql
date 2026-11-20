-- Étape 3 bis : le frigo. Ce qu'on a à la maison et qu'on ne veut ni racheter ni jeter.
-- Un article est libre (un reste : il peut servir à n'importe quelle semaine) ou réservé à la
-- liste d'une semaine (rangé depuis les courses : acheté pour ce menu-là). La liste de courses
-- déduit le stock libre et réserve ce qu'elle prend (shopping_items.from_fridge) ; quand la
-- semaine est finie, le bilan retire ce que les plats cuisinés ont consommé et libère le reste.
-- Les calculs vivent côté appli (lib/fridge.ts) ; ici, les invariants et les écritures groupées.

-- ─── Types ──────────────────────────────────────────────────────────────────
-- Ajouté à la main, rangé depuis les courses, reste d'un plat.
create type public.fridge_origin as enum ('manual', 'shopping', 'leftover');

-- ─── Table ──────────────────────────────────────────────────────────────────
create table public.fridge_items (
  id uuid primary key default gen_random_uuid(),
  -- Recopié de la liste réservée ou de l'ingrédient du foyer par trigger : sert à la RLS.
  household_id uuid not null references public.households (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete set null,
  -- Le nom canonique de l'ingrédient, ou un texte libre (« Reste : Lasagnes »).
  label text not null check (char_length(btrim(label)) between 1 and 80),
  -- Dans `unit` ; des parts pour un reste de plat. Null : quantité inconnue (« un fond de crème »).
  quantity numeric check (quantity > 0),
  -- Avec un ingrédient : forcément son unité d'achat (trigger).
  unit public.shopping_unit,
  best_before date,
  origin public.fridge_origin not null default 'manual',
  recipe_id uuid references public.recipes (id) on delete set null,
  -- Null : libre. Sinon, acheté pour la liste de cette semaine.
  reserved_list_id uuid references public.shopping_lists (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.fridge_items is 'Ce qu''on a à la maison : libre (un reste) ou réservé à la liste d''une semaine';
comment on column public.fridge_items.reserved_list_id is 'null = libre';
create index fridge_items_household_id_idx on public.fridge_items (household_id);
create index fridge_items_ingredient_id_idx on public.fridge_items (ingredient_id);
create index fridge_items_reserved_list_id_idx on public.fridge_items (reserved_list_id);
create index fridge_items_recipe_id_idx on public.fridge_items (recipe_id);

-- ─── Cohérence ──────────────────────────────────────────────────────────────
-- Le foyer vient de la liste réservée, sinon de l'ingrédient s'il est propre à un foyer, sinon de
-- l'appli. Une liste, un ingrédient ou une recette invisibles sous la RLS (un autre foyer) sont
-- refusés. Avec un ingrédient, l'unité est son unité d'achat : remplie si vide, refusée si autre.
create function private.check_fridge_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  list_household uuid;
  known public.ingredients;
begin
  if new.reserved_list_id is not null then
    select l.household_id into list_household
    from public.shopping_lists l
    where l.id = new.reserved_list_id;
    if list_household is null then
      raise exception 'Liste introuvable' using errcode = 'foreign_key_violation';
    end if;
    new.household_id := list_household;
  end if;

  if new.ingredient_id is not null then
    select * into known from public.ingredients i where i.id = new.ingredient_id;
    if known.id is null
       or (known.household_id is not null and new.reserved_list_id is not null
           and known.household_id <> new.household_id) then
      raise exception 'Ingrédient introuvable' using errcode = 'foreign_key_violation';
    end if;
    if known.household_id is not null then
      new.household_id := known.household_id;
    end if;

    if tg_op = 'INSERT'
       or new.ingredient_id is distinct from old.ingredient_id
       or new.unit is distinct from old.unit then
      if new.unit is null then
        new.unit := known.shopping_unit;
      elsif new.unit <> known.shopping_unit then
        raise exception 'L''unité d''un ingrédient est son unité d''achat' using errcode = 'check_violation';
      end if;
    end if;
  end if;

  if new.recipe_id is not null
     and (tg_op = 'INSERT' or new.recipe_id is distinct from old.recipe_id)
     and not exists (
       select 1
       from public.recipes r
       where r.id = new.recipe_id
         and (r.household_id is null or r.household_id = new.household_id)
     ) then
    raise exception 'Recette introuvable' using errcode = 'foreign_key_violation';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger fridge_items_check
  before insert or update on public.fridge_items
  for each row execute function private.check_fridge_item();

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.fridge_items enable row level security;
revoke all on public.fridge_items from anon;

create policy "Users manage fridge items of their households" on public.fridge_items
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Liste de courses et semaine ────────────────────────────────────────────
alter table public.shopping_items
  -- La quantité prise au frigo, dans l'unité d'achat : c'est la réservation.
  add column from_fridge numeric not null default 0 check (from_fridge >= 0),
  -- L'ingrédient est au frigo sans quantité connue : rien de déduit, juste signalé.
  add column maybe_in_fridge boolean not null default false,
  -- Déjà rangé au frigo (« Ranger les courses »).
  add column stored boolean not null default false;

comment on column public.shopping_items.removed is '« J''en ai déjà » : masqué, conservé à la mise à jour';

alter table public.shopping_lists
  -- Empreinte du stock libre (ingrédients du menu) au moment du calcul.
  add column fridge_signature text not null default '',
  -- La proposition « Ranger les courses » a été traitée (rangé, ou « Non merci »).
  add column stored_at timestamptz,
  -- Bilan de la semaine fait : plus aucune réservation.
  add column settled_at timestamptz;

-- Les semaines déjà passées n'ont rien à solder.
update public.shopping_lists l
set settled_at = now()
from public.week_plans wp
where wp.id = l.week_plan_id
  and wp.week_start + 7 <= (now() at time zone 'Europe/Paris')::date;

-- « Pas cuisiné » : ses ingrédients restent au frigo au bilan.
alter table public.planned_meals
  add column skipped boolean not null default false;

-- ─── Enregistrer la liste calculée ──────────────────────────────────────────
-- Comme dans 0010, plus la signature du frigo (`fridge`) et, par article, from_fridge,
-- maybe_in_fridge et stored.
drop function public.sync_shopping_list(uuid, text, jsonb);

create function public.sync_shopping_list(target_week_plan_id uuid, signature text, fridge text, items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_list_id uuid;
begin
  insert into public.shopping_lists (week_plan_id, menu_signature, fridge_signature)
  values (target_week_plan_id, coalesce(signature, ''), coalesce(fridge, ''))
  on conflict (week_plan_id) do update
    set menu_signature = excluded.menu_signature,
        fridge_signature = excluded.fridge_signature,
        updated_at = now()
  returning id into saved_list_id;

  delete from public.shopping_items i
  where i.list_id = saved_list_id
    and not i.manual;

  insert into public.shopping_items (
    list_id, ingredient_id, label, amounts, aisle, pantry, sources, checked, removed, needed,
    quantity_changed, position, from_fridge, maybe_in_fridge, stored
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
         coalesce((item ->> 'position')::integer, 0),
         coalesce((item ->> 'from_fridge')::numeric, 0),
         coalesce((item ->> 'maybe_in_fridge')::boolean, false),
         coalesce((item ->> 'stored')::boolean, false)
  from jsonb_array_elements(coalesce(items, '[]')) as item;

  return saved_list_id;
end;
$$;
revoke all on function public.sync_shopping_list(uuid, text, text, jsonb) from public, anon;
grant execute on function public.sync_shopping_list(uuid, text, text, jsonb) to authenticated;

-- ─── Bilan de la semaine ────────────────────────────────────────────────────
-- Applique les changements calculés côté appli (lib/fridge.ts, settleWeek) : [{id, quantity}],
-- nouvelle quantité, ou suppression si null. Puis libère tout ce qui reste réservé à la liste
-- et la marque soldée. La liste est verrouillée : deux téléphones ouverts en même temps, le
-- second attend, trouve la liste soldée et ne fait rien (rend false). La RLS s'applique.
create function public.apply_fridge_settlement(target_list_id uuid, changes jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  list public.shopping_lists;
begin
  select * into list
  from public.shopping_lists l
  where l.id = target_list_id
  for update;
  if list.id is null then
    raise exception 'Liste introuvable' using errcode = 'no_data_found';
  end if;
  if list.settled_at is not null then
    return false;
  end if;

  delete from public.fridge_items f
  using jsonb_array_elements(coalesce(changes, '[]')) as change
  where f.id = (change ->> 'id')::uuid
    and f.household_id = list.household_id
    and change ->> 'quantity' is null;

  update public.fridge_items f
  set quantity = (change ->> 'quantity')::numeric
  from jsonb_array_elements(coalesce(changes, '[]')) as change
  where f.id = (change ->> 'id')::uuid
    and f.household_id = list.household_id
    and change ->> 'quantity' is not null;

  update public.fridge_items f
  set reserved_list_id = null
  where f.reserved_list_id = list.id;

  update public.shopping_lists l
  set settled_at = now()
  where l.id = list.id;

  return true;
end;
$$;
revoke all on function public.apply_fridge_settlement(uuid, jsonb) from public, anon;
grant execute on function public.apply_fridge_settlement(uuid, jsonb) to authenticated;

-- ─── Durées de conservation du référentiel commun ───────────────────────────
-- En jours, une fois rangé : la date limite proposée au frigo (aujourd'hui + durée). Produits
-- frais seulement ; rien pour l'épicerie, le placard, les boissons ni le reste.
update public.ingredients i
set shelf_life_days = item.days
from (values
  -- Fruits et légumes fragiles : 3 à 5 jours ; qui tiennent : 14 à 30.
  (1, 4),    -- Avocats
  (2, 5),    -- Bananes
  (3, 5),    -- Brocolis
  (4, 21),   -- Carottes
  (5, 4),    -- Champignons de Paris
  (6, 7),    -- Choux-fleurs
  (7, 14),   -- Citrons
  (8, 7),    -- Concombres
  (9, 5),    -- Courgettes
  (10, 30),  -- Échalotes
  (11, 3),   -- Épinards frais
  (12, 3),   -- Framboises
  (13, 30),  -- Gousses d'ail
  (14, 3),   -- Jeunes pousses
  (15, 30),  -- Oignons
  (16, 7),   -- Poivrons
  (17, 21),  -- Pommes
  (18, 30),  -- Pommes de terre
  (19, 30),  -- Potimarron
  (20, 5),   -- Radis
  (21, 5),   -- Salades vertes
  (22, 5),   -- Tomates
  (23, 5),   -- Tomates cerises
  (24, 4),   -- Aneth
  (25, 4),   -- Ciboulette
  (26, 4),   -- Feuilles de basilic
  (27, 4),   -- Menthe
  (28, 5),   -- Persil
  (105, 4),  -- Abricots
  (106, 4),  -- Cerises
  (107, 14), -- Clémentines
  (108, 3),  -- Fraises
  (109, 10), -- Kiwis
  (110, 5),  -- Melons
  (111, 4),  -- Nectarines
  (112, 14), -- Oranges
  (113, 5),  -- Poires
  (114, 5),  -- Raisin
  (115, 5),  -- Betteraves cuites
  (116, 7),  -- Endives
  (117, 3),  -- Mâche
  (118, 7),  -- Poireaux
  -- Boucherie et poissonnerie : frais 2 à 3 jours, haché 1 ; charcuterie sous vide plus.
  (29, 2),   -- Blancs de poulet
  (30, 1),   -- Bœuf haché
  (31, 3),   -- Côtes de porc
  (32, 7),   -- Lardons
  (33, 3),   -- Pavés de bœuf
  (34, 3),   -- Poulets entiers
  (35, 1),   -- Steaks hachés pur bœuf
  (36, 7),   -- Tranches de bacon
  (37, 5),   -- Tranches de blanc de dinde
  (38, 5),   -- Tranches de jambon blanc
  (39, 2),   -- Pavés de saumon
  (40, 7),   -- Saumon fumé
  -- Crèmerie : ouverte 5 à 7 jours, fromages 10 à 15, beurre et œufs plus longtemps.
  (41, 30),  -- Beurre
  (42, 5),   -- Billes de mozzarella
  (43, 7),   -- Crème fraîche épaisse
  (44, 5),   -- Crème liquide
  (45, 7),   -- Feta
  (46, 7),   -- Fromage frais
  (47, 10),  -- Gruyère râpé
  (48, 5),   -- Houmous
  (49, 5),   -- Lait
  (50, 5),   -- Mozzarella
  (51, 7),   -- Mozzarella râpée
  (52, 21),  -- Œufs
  (53, 15),  -- Parmesan
  (54, 10),  -- Pâtes brisées
  (55, 14),  -- Yaourts nature
  (123, 30), -- Beurre demi-sel
  (124, 10), -- Camembert
  (125, 15), -- Comté
  (126, 14), -- Crèmes dessert
  (127, 15), -- Emmental
  (128, 7),  -- Fromage blanc
  (129, 10), -- Petits-suisses
  (130, 14), -- Yaourts aux fruits
  -- Boulangerie : pain 2 jours, pain de mie emballé une semaine.
  (56, 2),   -- Baguettes
  (57, 3),   -- Tranches de pain de campagne
  (58, 7),   -- Tranches de pain de mie
  (119, 5),  -- Brioche
  (120, 2),  -- Croissants
  (121, 2),  -- Pain
  (122, 2),  -- Pains au chocolat
  -- Surgelés : 90 jours.
  (103, 90), -- Frites surgelées au four
  (104, 90), -- Haricots verts
  (148, 90), -- Glaces
  (149, 90), -- Petits pois surgelés
  (150, 90), -- Pizzas surgelées
  (151, 90)  -- Poisson pané
) as item (n, days)
where i.id = ('1d9e0000-0000-4000-8000-' || lpad(item.n::text, 12, '0'))::uuid
  and i.household_id is null;

comment on column public.ingredients.shelf_life_days is 'Durée de conservation (jours) : date limite proposée au frigo';
