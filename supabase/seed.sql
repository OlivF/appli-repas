-- Comptes et foyer de test décrits dans CLAUDE.md. Rejoué par `supabase db reset`.
-- Connexion (mot de passe : motdepasse) :
--   test@example.com        : Olivier, a créé le foyer de test ;
--   marie-laure@popote.test : Marie-Laure, second compte du foyer ;
--   invite@popote.test      : sans foyer (e2e des invitations).

-- ─── Comptes ────────────────────────────────────────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', account.id::uuid,
  'authenticated', 'authenticated', account.email,
  extensions.crypt('motdepasse', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}', '{}',
  now(), now(),
  '', '', '', ''
from (values
  ('7e57a000-0000-4000-8000-000000000001', 'test@example.com'),
  ('7e57a000-0000-4000-8000-000000000002', 'marie-laure@popote.test'),
  ('7e57a000-0000-4000-8000-000000000003', 'invite@popote.test')
) as account (id, email);

insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text,
       json_build_object('sub', u.id, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id::text like '7e57a000-0000-4000-8000-%';

-- ─── Foyer ──────────────────────────────────────────────────────────────────
insert into public.households (id, name)
values ('7e57a000-1111-4000-8000-000000000001', 'Foyer de test');

-- Années de naissance calculées sur l'année en cours : les âges restent ceux de CLAUDE.md.
-- created_at échelonné pour garder cet ordre à l'affichage ; couleurs 0 à 4 dans cet ordre.
insert into public.members (id, household_id, first_name, birth_year, diets, appetite, created_at, color)
select id::uuid, '7e57a000-1111-4000-8000-000000000001', first_name,
       extract(year from now())::int - age, diets::public.diet[], appetite::public.appetite,
       now() - (5 - position) * interval '1 minute', position - 1
from (values
  (1, '7e57a000-2222-4000-8000-000000000001', 'Olivier',     40, '{}',     'normal'),
  (2, '7e57a000-2222-4000-8000-000000000002', 'Marie-Laure', 40, '{keto}', 'normal'),
  (3, '7e57a000-2222-4000-8000-000000000003', 'Timothé',     16, '{}',     'grand'),
  (4, '7e57a000-2222-4000-8000-000000000004', 'Anna-Lucia',   9, '{}',     'normal'),
  (5, '7e57a000-2222-4000-8000-000000000005', 'Otis',         6, '{}',     'normal')
) as member (position, id, first_name, age, diets, appetite);

-- ─── Comptes du foyer ───────────────────────────────────────────────────────
-- Tous deux peuvent inviter ; « C'est moi » pour afficher un prénom. Olivier est arrivé le premier.
insert into public.household_users (household_id, user_id, role, member_id, member_chosen_at, created_at)
values
  ('7e57a000-1111-4000-8000-000000000001', '7e57a000-0000-4000-8000-000000000001', 'admin',
   '7e57a000-2222-4000-8000-000000000001', now(), now() - interval '1 day'),
  ('7e57a000-1111-4000-8000-000000000001', '7e57a000-0000-4000-8000-000000000002', 'admin',
   '7e57a000-2222-4000-8000-000000000002', now(), now());

-- ─── Créneaux (jour : 0 = lundi … 6 = dimanche) ─────────────────────────────
-- Petit-déj et dîner pour tout le monde, tous les jours.
insert into public.meal_slots (household_id, day, meal_type, member_ids)
select '7e57a000-1111-4000-8000-000000000001', day, meal::public.meal_type,
       array[
         '7e57a000-2222-4000-8000-000000000001',
         '7e57a000-2222-4000-8000-000000000002',
         '7e57a000-2222-4000-8000-000000000003',
         '7e57a000-2222-4000-8000-000000000004',
         '7e57a000-2222-4000-8000-000000000005'
       ]::uuid[]
from generate_series(0, 6) as day,
     unnest(array['petit_dej', 'soir']) as meal;

-- Midi : Marie-Laure (cétogène) lundi, mardi, jeudi et vendredi.
insert into public.meal_slots (household_id, day, meal_type, member_ids)
select '7e57a000-1111-4000-8000-000000000001', day, 'midi',
       array['7e57a000-2222-4000-8000-000000000002']::uuid[]
from unnest(array[0, 1, 3, 4]) as day;

-- Mercredi midi : pique-nique rapide pour Anna-Lucia et Otis.
insert into public.meal_slots (household_id, day, meal_type, member_ids)
values (
  '7e57a000-1111-4000-8000-000000000001', 2, 'pique_nique',
  array['7e57a000-2222-4000-8000-000000000004', '7e57a000-2222-4000-8000-000000000005']::uuid[]
);
