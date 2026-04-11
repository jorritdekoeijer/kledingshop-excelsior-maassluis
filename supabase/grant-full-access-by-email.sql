-- Run once in Supabase → SQL Editor (runs as postgres; bypasses RLS).
-- Vervang het e-mailadres indien nodig, of laat zo voor jorritdekoeijer@gmail.com.
--
-- Doet twee dingen:
-- 1) Rol `admin` in public.user_roles (toegang tot /admin)
-- 2) Alle bekende dashboard-permissies in public.user_profiles.permissions
--
-- Werkt dit script niet (syntax / parser)? Gebruik dan:
--   grant-full-access-by-email-plain.sql
--
-- Veelvoorkomende meldingen:
-- - "Geen gebruiker met e-mail ..." → gebruiker staat nog niet in Authentication; eerst registreren.
-- - "type app_role does not exist" → migraties (0001_init.sql) niet op dit project toegepast.
-- - "relation user_profiles does not exist" → migraties (o.a. 0002) niet toegepast.

do $grant$
declare
  target_email text := 'jorritdekoeijer@gmail.com';
  uid uuid;
  perms text[] := array[
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
  ]::text[];
begin
  select u.id into uid
  from auth.users u
  where lower(u.email) = lower(target_email);

  if uid is null then
    raise exception 'Geen gebruiker met e-mail % in auth.users. Laat deze gebruiker eerst registreren of nodig uit.', target_email;
  end if;

  insert into public.user_roles (user_id, role)
  values (uid, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;

  insert into public.user_profiles (id, email, permissions)
  select u.id, u.email, perms
  from auth.users u
  where u.id = uid
  on conflict (id) do update set
    email = excluded.email,
    permissions = excluded.permissions;

  raise notice 'Klaar voor user % (id %).', target_email, uid;
end $grant$;
