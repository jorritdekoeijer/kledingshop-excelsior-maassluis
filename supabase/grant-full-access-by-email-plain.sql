-- Alternatief ZONDER DO $$ blok (handig als je een syntax- of parserfout krijgt).
-- Voer STAP 1 uit, kopieer het UUID, plak het overal waar YOUR_USER_ID staat.
-- Voer daarna STAP 2 en STAP 3 uit (in volgorde).

-- === STAP 1: controleer dat de gebruiker bestaat ===
select id, email, created_at
from auth.users
where lower(email) = lower('jorritdekoeijer@gmail.com');

-- Geen rij? Maak eerst een account aan (registreren / uitnodigen), daarna opnieuw STAP 1.

-- === STAP 2: admin-rol (vervang YOUR_USER_ID) ===
insert into public.user_roles (user_id, role)
values ('YOUR_USER_ID'::uuid, 'admin'::public.app_role)
on conflict (user_id, role) do nothing;

-- === STAP 3: alle dashboard-permissies (vervang YOUR_USER_ID) ===
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
