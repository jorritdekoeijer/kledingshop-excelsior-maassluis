-- Core shop schema + permissions + settings.

-- 1) Profiles → user_profiles with permissions
alter table if exists public.profiles rename to user_profiles;

alter table public.user_profiles
  add column if not exists permissions text[] not null default '{}';

-- Update policies (drop old names if present)
drop policy if exists "profiles_select_own" on public.user_profiles;
drop policy if exists "profiles_update_own" on public.user_profiles;

create policy "user_profiles_select_own" on public.user_profiles
  for select
  using (auth.uid() = id);

create policy "user_profiles_update_own" on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Fix trigger name after rename
drop trigger if exists profiles_set_updated_at on public.user_profiles;
drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- Update signup trigger function to write to user_profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Helper: check permission from user_profiles.permissions
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

-- Admin policies for user_profiles (users management)
drop policy if exists "user_profiles_select_admin" on public.user_profiles;
create policy "user_profiles_select_admin" on public.user_profiles
  for select
  using (public.has_permission('users:read'));

drop policy if exists "user_profiles_update_admin" on public.user_profiles;
create policy "user_profiles_update_admin" on public.user_profiles
  for update
  using (public.has_permission('users:write'))
  with check (public.has_permission('users:write'));

-- 2) Settings (SMTP, Mollie, monthly email day, etc.)
create table if not exists public.settings (
  id bigint generated always as identity primary key,
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "settings_select_admin" on public.settings
  for select
  using (public.has_permission('settings:read'));

create policy "settings_write_admin" on public.settings
  for all
  using (public.has_permission('settings:write'))
  with check (public.has_permission('settings:write'));

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

-- 3) Cost groups
create table if not exists public.cost_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cost_groups enable row level security;

create policy "cost_groups_select_admin" on public.cost_groups
  for select
  using (public.has_permission('cost_groups:read'));

create policy "cost_groups_write_admin" on public.cost_groups
  for all
  using (public.has_permission('cost_groups:write'))
  with check (public.has_permission('cost_groups:write'));

drop trigger if exists cost_groups_set_updated_at on public.cost_groups;
create trigger cost_groups_set_updated_at
before update on public.cost_groups
for each row execute function public.set_updated_at();

-- 4) Categories + Products
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  cost_group_id uuid references public.cost_groups (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;

create policy "categories_select_public" on public.categories
  for select
  using (true);

create policy "categories_write_admin" on public.categories
  for all
  using (public.has_permission('products:write'))
  with check (public.has_permission('products:write'));

create policy "products_select_public" on public.products
  for select
  using (active = true);

create policy "products_select_admin" on public.products
  for select
  using (public.has_permission('products:read'));

create policy "products_write_admin" on public.products
  for all
  using (public.has_permission('products:write'))
  with check (public.has_permission('products:write'));

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- 5) Stock batches (FIFO consumption will be app-side)
create table if not exists public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  received_at timestamptz not null default now(),
  quantity_received integer not null check (quantity_received >= 0),
  quantity_remaining integer not null check (quantity_remaining >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_remaining <= quantity_received)
);

create index if not exists stock_batches_fifo_idx
  on public.stock_batches (product_id, received_at asc, created_at asc);

alter table public.stock_batches enable row level security;

create policy "stock_batches_select_admin" on public.stock_batches
  for select
  using (public.has_permission('stock:read'));

create policy "stock_batches_write_admin" on public.stock_batches
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

drop trigger if exists stock_batches_set_updated_at on public.stock_batches;
create trigger stock_batches_set_updated_at
before update on public.stock_batches
for each row execute function public.set_updated_at();

-- 6) Orders + items + payments
create type if not exists public.order_status as enum (
  'created',
  'pending_payment',
  'paid',
  'cancelled',
  'fulfilled'
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  status public.order_status not null default 'created',
  total_cents integer not null default 0 check (total_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.mollie_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  mollie_payment_id text not null unique,
  status text not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.mollie_payments enable row level security;

create policy "orders_select_own" on public.orders
  for select
  using (auth.uid() = user_id);

create policy "orders_select_admin" on public.orders
  for select
  using (public.has_permission('orders:read'));

create policy "orders_write_admin" on public.orders
  for all
  using (public.has_permission('orders:write'))
  with check (public.has_permission('orders:write'));

create policy "order_items_select_own" on public.order_items
  for select
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

create policy "order_items_select_admin" on public.order_items
  for select
  using (public.has_permission('orders:read'));

create policy "order_items_write_admin" on public.order_items
  for all
  using (public.has_permission('orders:write'))
  with check (public.has_permission('orders:write'));

create policy "mollie_payments_select_admin" on public.mollie_payments
  for select
  using (public.has_permission('orders:read'));

create policy "mollie_payments_write_admin" on public.mollie_payments
  for all
  using (public.has_permission('orders:write'))
  with check (public.has_permission('orders:write'));

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists mollie_payments_set_updated_at on public.mollie_payments;
create trigger mollie_payments_set_updated_at
before update on public.mollie_payments
for each row execute function public.set_updated_at();

-- 7) Supabase Storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public can read product images
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select
  using (bucket_id = 'product-images');

-- Only admins (via service role in app) should upload/delete images.
drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write" on storage.objects
  for all
  using (bucket_id = 'product-images' and public.has_permission('products:write'))
  with check (bucket_id = 'product-images' and public.has_permission('products:write'));

