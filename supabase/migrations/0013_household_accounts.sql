-- Étape 3 ter : un foyer partagé entre plusieurs comptes.
-- Les comptes (household_users) organisent ; les mangeurs (members) mangent. Un compte n'a qu'un
-- foyer ; il peut inviter (admin) ou non (member) ; il reste toujours un compte qui peut inviter ;
-- le foyer disparaît avec son dernier compte. On rejoint un foyer avec un code d'invitation
-- (8 caractères, 7 jours, usage unique) partagé par lien /rejoindre/<code>.
-- Les tables métier ne changent pas : leur RLS passe déjà par private.is_household_member.
-- Toutes les écritures sur les comptes et les invitations passent par les fonctions ci-dessous.
--
-- Codes d'erreur (lib/household-accounts.ts les traduit) :
--   HA001 déjà dans un foyer · HA002 invitation qui ne marche plus · HA003 dernier compte qui peut
--   inviter · HA004 trop d'invitations en attente · HA005 se retirer soi-même ;
--   42501 pas le droit · P0002 introuvable · 23505 mangeur déjà choisi par un autre compte.

-- ─── Un compte = un foyer ───────────────────────────────────────────────────
-- Rien n'est supprimé : si un compte est dans plusieurs foyers, la migration s'arrête ici.
do $$
declare
  shared_accounts integer;
begin
  select count(*) into shared_accounts
  from (
    select hu.user_id
    from public.household_users hu
    group by hu.user_id
    having count(*) > 1
  ) shared;

  if shared_accounts > 0 then
    raise exception '% compte(s) font partie de plusieurs foyers : un compte ne peut plus avoir qu''un foyer. Rattache chacun à un seul foyer, puis relance la migration (rien n''a été supprimé).', shared_accounts
      using hint = 'select user_id, array_agg(household_id) from public.household_users group by user_id having count(*) > 1;';
  end if;
end;
$$;

-- ─── Comptes : rôle et « C'est moi » ────────────────────────────────────────
create type public.household_role as enum ('admin', 'member');

alter table public.household_users
  add column role public.household_role not null default 'member',
  -- « C'est moi » : sert seulement à afficher un prénom au lieu d'un email.
  add column member_id uuid references public.members (id) on delete set null,
  -- Réponse à « Qui es-tu à table ? » (null : jamais répondu ; avec member_id null : « Je ne mange
  -- pas ici »).
  add column member_chosen_at timestamptz;

comment on column public.household_users.role is 'admin : peut inviter et retirer des comptes ; member : tout le reste';
comment on column public.household_users.member_id is '« C''est moi » : affichage seulement, ne change rien aux repas';

-- Les comptes déjà rattachés ont créé leur foyer : ils peuvent inviter.
update public.household_users set role = 'admin';

-- L'unique remplace l'index de 0001.
drop index public.household_users_user_id_idx;
alter table public.household_users
  add constraint household_users_user_id_key unique (user_id);

-- Un mangeur n'est le « C'est moi » que d'un seul compte.
create unique index household_users_member_id_key
  on public.household_users (member_id)
  where member_id is not null;

-- Le « C'est moi » est un mangeur du même foyer.
create function private.check_household_user_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.member_id is not null and not exists (
    select 1
    from public.members m
    where m.id = new.member_id
      and m.household_id = new.household_id
  ) then
    raise exception 'Ce prénom n''est pas dans ton foyer' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger household_users_check_member
  before insert or update of member_id, household_id on public.household_users
  for each row execute function private.check_household_user_member();

-- Lecture seule pour l'API (la politique select de 0001 reste) : tout passe par les fonctions.
revoke insert, update, delete, truncate on public.household_users from authenticated;

-- ─── Peut inviter ───────────────────────────────────────────────────────────
-- Sur le modèle de is_household_member : lit household_users sans repasser par sa RLS.
create function private.is_household_admin(target_household_id uuid)
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
      and hu.role = 'admin'
  );
$$;
revoke all on function private.is_household_admin(uuid) from public;
grant execute on function private.is_household_admin(uuid) to authenticated;

-- ─── Invitations ────────────────────────────────────────────────────────────
-- Lisible au téléphone : ni 0, O, 1, I ni L.
create function private.normalize_invite_code(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Majuscules ; espaces et tirets retirés (y compris les tirets longs du clavier du téléphone).
  select case when cleaned ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$' then cleaned end
  from (
    select upper(regexp_replace(coalesce(raw, ''), '[[:space:]\-‐‑‒–—−]', '', 'g')) as cleaned
  ) code;
$$;

-- 8 caractères tirés de gen_random_bytes. Un octet vaut 0..255 ; on ne garde que 0..247
-- (8 × 31) pour que le modulo 31 ne favorise aucun caractère.
create function private.new_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  bytes bytea;
  value integer;
begin
  while char_length(code) < 8 loop
    bytes := extensions.gen_random_bytes(16);
    for i in 0 .. 15 loop
      value := get_byte(bytes, i);
      if value < 248 and char_length(code) < 8 then
        code := code || substr(alphabet, value % 31 + 1, 1);
      end if;
    end loop;
  end loop;
  return code;
end;
$$;

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'),
  -- Rôle donné au compte qui accepte.
  role public.household_role not null default 'admin',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);
comment on table public.household_invites is 'Code à usage unique, 7 jours, partagé par lien /rejoindre/<code>';
create index household_invites_household_id_idx on public.household_invites (household_id);
create index household_invites_created_by_idx on public.household_invites (created_by);

-- Dans cet ordre : utilisée, annulée, expirée, sinon valide.
create function private.invite_status(invite public.household_invites)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when invite.used_at is not null then 'used'
    when invite.revoked_at is not null then 'revoked'
    when invite.expires_at <= now() then 'expired'
    else 'valid'
  end;
$$;

-- Les invitations en attente d'un compte : annulées quand il part, est retiré ou ne peut plus
-- inviter (il ne revient pas par un lien gardé de côté).
create function private.revoke_pending_invites(target_household_id uuid, author_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.household_invites i
  set revoked_at = now()
  where i.household_id = target_household_id
    and i.created_by = author_id
    and i.used_at is null
    and i.revoked_at is null
    and i.expires_at > now();
$$;

-- Seuls les comptes qui peuvent inviter lisent les invitations de leur foyer ; aucune écriture
-- directe.
alter table public.household_invites enable row level security;
revoke all on public.household_invites from anon, authenticated;
grant select on public.household_invites to authenticated;

create policy "Admins read invites of their households" on public.household_invites
  for select to authenticated
  using (private.is_household_admin(household_id));

-- ─── Départ d'un compte ─────────────────────────────────────────────────────
-- Aussi quand un compte Supabase est supprimé (cascade). Ses invitations en attente sont
-- annulées ; plus aucun compte : le foyer est supprimé, avec tout ce qu'il contient ; plus
-- personne qui peut inviter : le compte arrivé le premier le peut désormais.
create function private.after_household_user_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.revoke_pending_invites(old.household_id, old.user_id);

  if not exists (
    select 1 from public.household_users hu where hu.household_id = old.household_id
  ) then
    delete from public.households h where h.id = old.household_id;
  elsif not exists (
    select 1 from public.household_users hu
    where hu.household_id = old.household_id and hu.role = 'admin'
  ) then
    update public.household_users hu
    set role = 'admin'
    where hu.household_id = old.household_id
      and hu.user_id = (
        select oldest.user_id
        from public.household_users oldest
        where oldest.household_id = old.household_id
        order by oldest.created_at, oldest.user_id
        limit 1
      );
  end if;

  return null;
end;
$$;

create trigger household_users_after_delete
  after delete on public.household_users
  for each row execute function private.after_household_user_removed();

-- ─── Création d'un foyer ────────────────────────────────────────────────────
-- Le créateur peut inviter ; un compte qui a déjà un foyer n'en crée pas un second.
create or replace function public.create_household(household_name text)
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

  if exists (select 1 from public.household_users hu where hu.user_id = (select auth.uid())) then
    raise exception 'Tu fais déjà partie d''un foyer' using errcode = 'HA001';
  end if;

  insert into public.households (name)
  values (btrim(household_name))
  returning id into new_household_id;

  insert into public.household_users (household_id, user_id, role)
  values (new_household_id, (select auth.uid()), 'admin');

  return new_household_id;
end;
$$;

-- ─── Inviter ────────────────────────────────────────────────────────────────
create function public.create_household_invite(
  target_household_id uuid,
  invite_role public.household_role default 'admin'
)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  new_code text;
  invite public.household_invites;
begin
  if not private.is_household_admin(target_household_id) then
    raise exception 'Seule une personne qui peut inviter crée un lien' using errcode = 'insufficient_privilege';
  end if;

  -- Une invitation à la fois par foyer : le compte des invitations en attente reste juste.
  perform 1 from public.households h where h.id = target_household_id for update;

  if (
    select count(*)
    from public.household_invites i
    where i.household_id = target_household_id
      and i.used_at is null
      and i.revoked_at is null
      and i.expires_at > now()
  ) >= 5 then
    raise exception 'Il y a déjà 5 invitations en attente : annules-en une avant d''en créer une autre'
      using errcode = 'HA004';
  end if;

  loop
    new_code := private.new_invite_code();
    exit when not exists (select 1 from public.household_invites i where i.code = new_code);
  end loop;

  insert into public.household_invites (household_id, code, role, created_by)
  values (target_household_id, new_code, coalesce(invite_role, 'admin'), (select auth.uid()))
  returning * into invite;

  return query select invite.code, invite.expires_at;
end;
$$;

-- L'invitation d'un foyer dont l'appelant peut inviter ; introuvable s'il n'en est pas membre.
create function private.invite_for_admin(invite_id uuid)
returns public.household_invites
language plpgsql
set search_path = ''
as $$
declare
  invite public.household_invites;
begin
  select * into invite from public.household_invites i where i.id = invite_id for update;
  if invite.id is null or not private.is_household_member(invite.household_id) then
    raise exception 'Invitation introuvable' using errcode = 'no_data_found';
  end if;
  if not private.is_household_admin(invite.household_id) then
    raise exception 'Seule une personne qui peut inviter gère les invitations' using errcode = 'insufficient_privilege';
  end if;
  return invite;
end;
$$;

create function public.revoke_household_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invites := private.invite_for_admin(invite_id);
begin
  update public.household_invites i
  set revoked_at = now()
  where i.id = invite.id
    and i.used_at is null
    and i.revoked_at is null;
end;
$$;

-- « Pourra aussi inviter d'autres personnes » : le code ne change pas.
create function public.set_household_invite_role(invite_id uuid, new_role public.household_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invites := private.invite_for_admin(invite_id);
begin
  if private.invite_status(invite) <> 'valid' then
    raise exception 'Cette invitation ne marche plus' using errcode = 'HA002';
  end if;

  update public.household_invites i
  set role = coalesce(new_role, 'admin')
  where i.id = invite.id;
end;
$$;

-- ─── Rejoindre ──────────────────────────────────────────────────────────────
-- Ce que montre la page d'invitation, avant même la création du compte. Rien d'autre : ni id ni
-- email. Le nom du foyer et le prénom de l'invitant seulement si le code marche encore ;
-- is_member : le compte connecté est déjà dans ce foyer (toujours faux sans compte).
create function public.household_invite_preview(invite_code text)
returns table (household_name text, inviter_name text, status text, is_member boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  invite public.household_invites;
  invite_status text;
begin
  select * into invite
  from public.household_invites i
  where i.code = private.normalize_invite_code(invite_code);

  if invite.id is null then
    return query select null::text, null::text, 'unknown'::text, false;
    return;
  end if;

  invite_status := private.invite_status(invite);

  return query
  select
    case when invite_status = 'valid' then h.name end,
    case when invite_status = 'valid' then (
      select m.first_name
      from public.household_users hu
      join public.members m on m.id = hu.member_id
      where hu.household_id = invite.household_id
        and hu.user_id = invite.created_by
    ) end,
    invite_status,
    private.is_household_member(invite.household_id)
  from public.households h
  where h.id = invite.household_id;
end;
$$;

-- Rejoint le foyer de l'invitation, en une transaction. Déjà dedans : rien. Avec un autre foyer :
-- refusé tant que leave_current est faux ; sinon on le quitte d'abord (le trigger de départ
-- applique « dernier compte » et « plus personne qui peut inviter »).
create function public.accept_household_invite(invite_code text, leave_current boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  invite public.household_invites;
  current_household uuid;
begin
  if me is null then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;

  select * into invite
  from public.household_invites i
  where i.code = private.normalize_invite_code(invite_code)
  for update;

  if invite.id is null or private.invite_status(invite) <> 'valid' then
    raise exception 'Ce lien ne marche plus' using errcode = 'HA002';
  end if;

  select hu.household_id into current_household
  from public.household_users hu
  where hu.user_id = me
  for update;

  if current_household = invite.household_id then
    return invite.household_id;
  end if;

  if current_household is not null then
    if not coalesce(leave_current, false) then
      raise exception 'Tu fais déjà partie d''un foyer' using errcode = 'HA001';
    end if;
    delete from public.household_users hu where hu.user_id = me;
  end if;

  insert into public.household_users (household_id, user_id, role)
  values (invite.household_id, me, invite.role);

  update public.household_invites i
  set used_by = me, used_at = now()
  where i.id = invite.id;

  return invite.household_id;
end;
$$;

-- ─── Gérer les comptes ──────────────────────────────────────────────────────
-- Les comptes du foyer de l'appelant, par ordre d'arrivée.
create function public.household_accounts()
returns table (
  user_id uuid,
  email text,
  role public.household_role,
  member_id uuid,
  member_chosen_at timestamptz,
  joined_at timestamptz,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select hu.user_id, u.email::text, hu.role, hu.member_id, hu.member_chosen_at, hu.created_at,
         hu.user_id = (select auth.uid())
  from public.household_users hu
  join auth.users u on u.id = hu.user_id
  where hu.household_id = (
    select mine.household_id from public.household_users mine where mine.user_id = (select auth.uid())
  )
  order by hu.created_at, hu.user_id;
$$;

-- Le foyer de l'appelant s'il peut inviter, verrouillé : deux changements de rôle simultanés
-- ne retirent pas ensemble les deux derniers droits d'inviter.
create function private.my_household_as_admin()
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  household uuid;
begin
  select hu.household_id into household
  from public.household_users hu
  where hu.user_id = (select auth.uid());

  if household is null or not private.is_household_admin(household) then
    raise exception 'Seule une personne qui peut inviter gère les comptes du foyer'
      using errcode = 'insufficient_privilege';
  end if;

  perform 1 from public.households h where h.id = household for update;
  return household;
end;
$$;

create function public.set_household_role(target_user_id uuid, new_role public.household_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.my_household_as_admin();
begin
  if new_role is null then
    raise exception 'Rôle manquant' using errcode = 'null_value_not_allowed';
  end if;

  if not exists (
    select 1 from public.household_users hu
    where hu.household_id = household and hu.user_id = target_user_id
  ) then
    raise exception 'Cette personne ne fait pas partie du foyer' using errcode = 'no_data_found';
  end if;

  if new_role = 'member' and not exists (
    select 1 from public.household_users hu
    where hu.household_id = household and hu.role = 'admin' and hu.user_id <> target_user_id
  ) then
    raise exception 'Il faut garder au moins une personne qui peut inviter' using errcode = 'HA003';
  end if;

  update public.household_users hu
  set role = new_role
  where hu.household_id = household and hu.user_id = target_user_id;

  if new_role = 'member' then
    perform private.revoke_pending_invites(household, target_user_id);
  end if;
end;
$$;

create function public.remove_household_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := private.my_household_as_admin();
begin
  if target_user_id = (select auth.uid()) then
    raise exception 'Pour toi, c''est « Quitter ce foyer »' using errcode = 'HA005';
  end if;

  delete from public.household_users hu
  where hu.household_id = household and hu.user_id = target_user_id;

  if not found then
    raise exception 'Cette personne ne fait pas partie du foyer' using errcode = 'no_data_found';
  end if;
end;
$$;

create function public.leave_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;

  delete from public.household_users hu where hu.user_id = (select auth.uid());

  if not found then
    raise exception 'Tu ne fais partie d''aucun foyer' using errcode = 'no_data_found';
  end if;
end;
$$;

-- « C'est moi » du compte connecté ; null : « Je ne mange pas ici ». La réponse est retenue.
create function public.set_my_member(target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid;
begin
  select hu.household_id into household
  from public.household_users hu
  where hu.user_id = (select auth.uid());

  if household is null then
    raise exception 'Tu ne fais partie d''aucun foyer' using errcode = 'no_data_found';
  end if;

  if target_member_id is not null and not exists (
    select 1 from public.members m where m.id = target_member_id and m.household_id = household
  ) then
    raise exception 'Ce prénom n''est pas dans ton foyer' using errcode = 'no_data_found';
  end if;

  begin
    update public.household_users hu
    set member_id = target_member_id, member_chosen_at = now()
    where hu.user_id = (select auth.uid());
  exception when unique_violation then
    raise exception 'Une autre personne du foyer a déjà choisi ce prénom' using errcode = 'unique_violation';
  end;
end;
$$;

-- ─── Droits ─────────────────────────────────────────────────────────────────
revoke all on function public.create_household_invite(uuid, public.household_role) from public, anon;
revoke all on function public.revoke_household_invite(uuid) from public, anon;
revoke all on function public.set_household_invite_role(uuid, public.household_role) from public, anon;
revoke all on function public.household_invite_preview(text) from public;
revoke all on function public.accept_household_invite(text, boolean) from public, anon;
revoke all on function public.household_accounts() from public, anon;
revoke all on function public.set_household_role(uuid, public.household_role) from public, anon;
revoke all on function public.remove_household_account(uuid) from public, anon;
revoke all on function public.leave_household() from public, anon;
revoke all on function public.set_my_member(uuid) from public, anon;

grant execute on function public.create_household_invite(uuid, public.household_role) to authenticated;
grant execute on function public.revoke_household_invite(uuid) to authenticated;
grant execute on function public.set_household_invite_role(uuid, public.household_role) to authenticated;
-- La page d'invitation l'affiche avant la création du compte.
grant execute on function public.household_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_household_invite(text, boolean) to authenticated;
grant execute on function public.household_accounts() to authenticated;
grant execute on function public.set_household_role(uuid, public.household_role) to authenticated;
grant execute on function public.remove_household_account(uuid) to authenticated;
grant execute on function public.leave_household() to authenticated;
grant execute on function public.set_my_member(uuid) to authenticated;

-- Fonctions internes : jamais appelées directement par l'API.
revoke all on function private.check_household_user_member() from public;
revoke all on function private.normalize_invite_code(text) from public;
revoke all on function private.new_invite_code() from public;
revoke all on function private.invite_status(public.household_invites) from public;
revoke all on function private.revoke_pending_invites(uuid, uuid) from public;
revoke all on function private.after_household_user_removed() from public;
revoke all on function private.invite_for_admin(uuid) from public;
revoke all on function private.my_household_as_admin() from public;
