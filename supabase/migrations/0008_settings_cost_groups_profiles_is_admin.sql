-- Admins (user_roles.admin / is_admin) mogen dezelfde data beheren als commissie-permissies,
-- zodat de admin-UI instellingen kan laden zonder aparte permissie-strings op user_profiles.
--
-- `cost_groups` hoort bij 0002_core_schema.sql. Ontbreekt die tabel (bijv. alleen latere SQL gedraaid),
-- dan wordt hij hier aangemaakt. Commissie-policies uit 0002 worden alleen toegevoegd als ze nog niet bestaan.

-- 1) Kostengroepen — tabel + trigger (idempotent)
create table if not exists public.cost_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cost_groups enable row level security;

drop trigger if exists cost_groups_set_updated_at on public.cost_groups;
create trigger cost_groups_set_updated_at
before update on public.cost_groups
for each row execute function public.set_updated_at();

-- Commissie-basis (zoals 0002), alleen als nog niet aanwezig — voorkomt conflict als 0002 later alsnog draait
do $cg$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cost_groups'
      and policyname = 'cost_groups_select_admin'
  ) then
    create policy "cost_groups_select_admin" on public.cost_groups
      for select
      using (public.has_permission('cost_groups:read'));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cost_groups'
      and policyname = 'cost_groups_write_admin'
  ) then
    create policy "cost_groups_write_admin" on public.cost_groups
      for all
      using (public.has_permission('cost_groups:write'))
      with check (public.has_permission('cost_groups:write'));
  end if;
end
$cg$;

-- Admin op cost_groups (idempotent)
drop policy if exists "cost_groups_select_is_admin" on public.cost_groups;
create policy "cost_groups_select_is_admin" on public.cost_groups
  for select
  using (public.is_admin());

drop policy if exists "cost_groups_write_is_admin" on public.cost_groups;
create policy "cost_groups_write_is_admin" on public.cost_groups
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 2) Settings
drop policy if exists "settings_select_is_admin" on public.settings;
create policy "settings_select_is_admin" on public.settings
  for select
  using (public.is_admin());

drop policy if exists "settings_write_is_admin" on public.settings;
create policy "settings_write_is_admin" on public.settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 3) User profiles
drop policy if exists "user_profiles_select_is_admin" on public.user_profiles;
create policy "user_profiles_select_is_admin" on public.user_profiles
  for select
  using (public.is_admin());

drop policy if exists "user_profiles_update_is_admin" on public.user_profiles;
create policy "user_profiles_update_is_admin" on public.user_profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());
