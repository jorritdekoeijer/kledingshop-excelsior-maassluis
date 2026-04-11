-- Align legacy / template schemas: sommige projecten hebben public.user_profiles.user_id
-- i.p.v. id. Deze app verwacht overal kolom id (= auth.users.id).
-- Idempotent: alleen actief als user_id bestaat en id nog niet.

-- Eerst: functie op kolom `id` (geen validatie op bestaan van kolommen bij CREATE FUNCTION)
create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
as $fn$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and required_permission = any (up.permissions)
  );
$fn$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$fn$;

do $migrate$
declare
  pol record;
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'user_profiles'
      and c.column_name = 'user_id'
  )
  and not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'user_profiles'
      and c.column_name = 'id'
  ) then
    alter table public.user_profiles
      add column if not exists permissions text[] not null default '{}';

    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'user_profiles'
    loop
      execute format('drop policy if exists %I on public.user_profiles', pol.policyname);
    end loop;

    alter table public.user_profiles rename column user_id to id;

    create policy "user_profiles_select_own" on public.user_profiles
      for select
      using (auth.uid() = id);

    create policy "user_profiles_update_own" on public.user_profiles
      for update
      using (auth.uid() = id)
      with check (auth.uid() = id);

    create policy "user_profiles_select_admin" on public.user_profiles
      for select
      using (public.has_permission('users:read'));

    create policy "user_profiles_update_admin" on public.user_profiles
      for update
      using (public.has_permission('users:write'))
      with check (public.has_permission('users:write'));
  end if;
end
$migrate$;
