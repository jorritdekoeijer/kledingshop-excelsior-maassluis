-- Alternatief ZONDER één groot DO-blok.
-- Voer STAP 1 uit, kopieer het UUID, plak overal waar YOUR_USER_ID staat.
--
-- STAP 0 (optioneel): welke kolom heeft user_profiles?
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'user_profiles' order by ordinal_position;
--
-- Gebruik STAP 3a als je kolom `id` hebt (zoals in de migraties van dit project).
-- Gebruik STAP 3b als je alleen `user_id` hebt (geen `id`).

-- === STAP 1: controleer dat de gebruiker bestaat ===
select id, email, created_at
from auth.users
where lower(email) = lower('jorritdekoeijer@gmail.com');

-- Geen rij? Maak eerst een account aan (registreren / uitnodigen), daarna opnieuw STAP 1.

-- === STAP 2: admin-rol (vervang YOUR_USER_ID) ===
insert into public.user_roles (user_id, role)
values ('YOUR_USER_ID'::uuid, 'admin'::public.app_role)
on conflict (user_id, role) do nothing;

-- === STAP 3a: permissies — als user_profiles.id bestaat ===
insert into public.user_profiles (id, email, permissions)
select
  u.id,
  u.email,
  array[
    'dashboard:access',
    'users:read',
    'users:write',
    'settings:read',
    'settings:write',
    'cost_groups:read',
    'cost_groups:write',
    'products:read',
    'products:write',
    'stock:read',
    'stock:write',
    'orders:read',
    'orders:write'
  ]::text[]
from auth.users u
where u.id = 'YOUR_USER_ID'::uuid
on conflict (id) do update set
  email = excluded.email,
  permissions = excluded.permissions;

-- === STAP 3b: permissies — alleen als je géén `id` maar wél `user_id` hebt (STAP 3a overslaan) ===
-- insert into public.user_profiles (user_id, email, permissions)
-- select
--   u.id,
--   u.email,
--   array[
--     'dashboard:access',
--     'users:read',
--     'users:write',
--     'settings:read',
--     'settings:write',
--     'cost_groups:read',
--     'cost_groups:write',
--     'products:read',
--     'products:write',
--     'stock:read',
--     'stock:write',
--     'orders:read',
--     'orders:write'
--   ]::text[]
-- from auth.users u
-- where u.id = 'YOUR_USER_ID'::uuid
-- on conflict (user_id) do update set
--   email = excluded.email,
--   permissions = excluded.permissions;
