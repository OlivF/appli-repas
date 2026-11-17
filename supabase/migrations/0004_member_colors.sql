-- Une couleur pastel par membre (variables --member-0 à --member-7 de globals.css).
-- Attribuée à l'ajout : la première libre du foyer. Elle ne change plus ensuite.

alter table public.members
  add column color smallint check (color between 0 and 7);

-- Membres existants : dans l'ordre où ils ont été ajoutés.
update public.members m
set color = ranked.position % 8
from (
  select id, row_number() over (partition by household_id order by created_at, id) - 1 as position
  from public.members
) as ranked
where m.id = ranked.id;

alter table public.members alter column color set not null;

-- Un ajout en lot voit les membres ajoutés juste avant lui dans la même requête :
-- chacun reçoit donc une couleur différente.
create function private.assign_member_color()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.color is null then
    select coalesce(
      min(palette.color),
      (select count(*) % 8 from public.members m where m.household_id = new.household_id)
    )
    into new.color
    from generate_series(0, 7) as palette (color)
    where not exists (
      select 1
      from public.members m
      where m.household_id = new.household_id
        and m.color = palette.color
    );
  end if;
  return new;
end;
$$;

create trigger members_assign_color
  before insert on public.members
  for each row execute function private.assign_member_color();

-- Défaut « à attribuer » : rend la colonne facultative à l'insertion (types TypeScript
-- générés compris) ; le trigger ci-dessus pose la vraie couleur. Postgres ignore un
-- simple « default null », d'où cette fonction.
create function private.unassigned_member_color()
returns smallint
language plpgsql
volatile
set search_path = ''
as $$
begin
  return null;
end;
$$;

alter table public.members alter column color set default private.unassigned_member_color();
