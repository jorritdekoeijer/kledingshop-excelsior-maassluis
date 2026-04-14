-- Run once in Supabase → SQL Editor (runs as postgres; bypasses RLS).
-- Vervang het e-mailadres indien nodig, of laat zo voor jorritdekoeijer@gmail.com.
--
-- Doet twee dingen:
-- 1) Rol `admin` in public.user_roles (toegang tot /admin)
-- 2) Alle bekende dashboard-permissies in public.user_profiles.permissions
--
-- Ondersteunt user_profiles met primaire sleutel `id` (migraties) óf `user_id` (sommige templates).
--
-- Werkt dit script niet (syntax / parser)? Gebruik dan:
--   grant-full-access-by-email-plain.sql
--
-- Veelvoorkomende meldingen:
-- - "Geen gebruiker met e-mail ..." → gebruiker staat nog niet in Authentication; eerst registreren.
-- - "type app_role does not exist" → migraties (0001_init.sql) niet op dit project toegepast.
-- - "relation user_profiles does not exist" → migraties (o.a. 0002) niet toegepast.
-- - Kolom user_id maar app verwacht id → schema gelijk trekken aan supabase/migrations (anders werkt de Next.js app niet).

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
    'orders:write',
    'reporting:read',
    'reporting:write',
    'suppliers:read',
    'suppliers:write'
  ]::text[];
  has_id boolean;
  has_user_id boolean;
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

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'user_profiles'
      and c.column_name = 'id'
  ) into has_id;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'user_profiles'
      and c.column_name = 'user_id'
  ) into has_user_id;

  if has_id then
    insert into public.user_profiles (id, email, permissions)
    select u.id, u.email, perms
    from auth.users u
    where u.id = uid
    on conflict (id) do update set
      email = excluded.email,
      permissions = excluded.permissions;
  elsif has_user_id then
    insert into public.user_profiles (user_id, email, permissions)
    select u.id, u.email, perms
    from auth.users u
    where u.id = uid
    on conflict (user_id) do update set
      email = excluded.email,
      permissions = excluded.permissions;
  else
    raise exception 'public.user_profiles heeft noch kolom id noch user_id. Controleer je schema.';
  end if;

  raise notice 'Klaar voor user % (id %).', target_email, uid;
end $grant$;
