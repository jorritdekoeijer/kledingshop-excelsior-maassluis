-- Reparatie: public.categories ontbreekt (bijv. 0002_core_schema.sql nooit op dit project gedraaid).
-- Idempotent: veilig om opnieuw uit te voeren.
--
-- Opmerking Postgres: voor functies bestaat geen CREATE ... IF NOT EXISTS; we gebruiken
-- CREATE OR REPLACE FUNCTION (even idempotent). Voor policies: DROP IF EXISTS + CREATE.

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

-- Zelfde als start van 0002: profiles → user_profiles (alleen als die nog zo heet)
alter table if exists public.profiles rename to user_profiles;

-- Minimale profieltabel als 0001/0002 nog niet gedraaid zijn (structuur sluit aan op 0001 + permissions uit 0002)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text,
  permissions text[] not null default '{}'
);

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
