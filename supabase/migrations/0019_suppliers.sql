-- Leveranciers (NAW + e-mail) + koppeling aan leveranciersbestellingen.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

drop policy if exists "suppliers_select_admin" on public.suppliers;
create policy "suppliers_select_admin" on public.suppliers
  for select
  using (public.has_permission('settings:read'));

drop policy if exists "suppliers_write_admin" on public.suppliers;
create policy "suppliers_write_admin" on public.suppliers
  for all
  using (public.has_permission('settings:write'))
  with check (public.has_permission('settings:write'));

create index if not exists suppliers_name_idx on public.suppliers (name);

alter table public.supplier_orders
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;

