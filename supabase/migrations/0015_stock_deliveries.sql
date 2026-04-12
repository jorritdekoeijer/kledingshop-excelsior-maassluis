-- Leveringen (factuurkop) + regelvelden op stock_batches voor maat en inkoop excl. btw.

create table if not exists public.stock_deliveries (
  id uuid primary key default gen_random_uuid(),
  invoice_date date,
  supplier text,
  invoice_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stock_deliveries enable row level security;

drop policy if exists "stock_deliveries_select_admin" on public.stock_deliveries;
create policy "stock_deliveries_select_admin" on public.stock_deliveries
  for select
  using (public.has_permission('stock:read'));

drop policy if exists "stock_deliveries_write_admin" on public.stock_deliveries;
create policy "stock_deliveries_write_admin" on public.stock_deliveries
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

drop trigger if exists stock_deliveries_set_updated_at on public.stock_deliveries;
create trigger stock_deliveries_set_updated_at
before update on public.stock_deliveries
for each row execute function public.set_updated_at();

alter table public.stock_batches
  add column if not exists stock_delivery_id uuid references public.stock_deliveries (id) on delete set null,
  add column if not exists size_label text,
  add column if not exists unit_purchase_excl_cents integer;

alter table public.stock_batches
  drop constraint if exists stock_batches_unit_purchase_check;

alter table public.stock_batches
  add constraint stock_batches_unit_purchase_check
  check (unit_purchase_excl_cents is null or unit_purchase_excl_cents >= 0);

create index if not exists stock_batches_delivery_idx on public.stock_batches (stock_delivery_id);
