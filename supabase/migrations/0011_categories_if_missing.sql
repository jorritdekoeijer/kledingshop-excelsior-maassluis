-- Reparatie: public.categories ontbreekt (bijv. 0002_core_schema.sql nooit op dit project gedraaid).
-- Idempotent: veilig om opnieuw uit te voeren.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Zelfde als start van 0002: profiles → user_profiles
alter table if exists public.profiles rename to user_profiles;

do $check$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_profiles'
  ) then
    raise exception
      'public.user_profiles ontbreekt. Voer eerst migrations/0001_init.sql uit (of: supabase db push vanaf een lege DB).';
  end if;
end;
$check$;

alter table public.user_profiles
  add column if not exists permissions text[] not null default '{}';

create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and required_permission = any (up.permissions)
  );
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;

drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public" on public.categories
  for select
  using (true);

drop policy if exists "categories_write_admin" on public.categories;
create policy "categories_write_admin" on public.categories
  for all
  using (public.has_permission('products:write'))
  with check (public.has_permission('products:write'));

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();
