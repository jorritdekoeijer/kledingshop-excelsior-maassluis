-- Automatische aanvulregels per maat + leveranciersbestellingen (draft).

-- 1) Reorder rules per product + variant + maat
create table if not exists public.stock_reorder_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_segment text not null,
  size_label text not null,
  is_active boolean not null default false,
  threshold_qty integer not null default 0 check (threshold_qty >= 0),
  target_qty integer not null default 0 check (target_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, variant_segment, size_label)
);

alter table public.stock_reorder_rules
  drop constraint if exists stock_reorder_rules_variant_segment_check;
alter table public.stock_reorder_rules
  add constraint stock_reorder_rules_variant_segment_check
  check (variant_segment in ('youth', 'adult'));

alter table public.stock_reorder_rules enable row level security;

drop trigger if exists stock_reorder_rules_set_updated_at on public.stock_reorder_rules;
create trigger stock_reorder_rules_set_updated_at
before update on public.stock_reorder_rules
for each row execute function public.set_updated_at();

drop policy if exists "stock_reorder_rules_select_admin" on public.stock_reorder_rules;
create policy "stock_reorder_rules_select_admin" on public.stock_reorder_rules
  for select
  using (public.has_permission('stock:read'));

drop policy if exists "stock_reorder_rules_write_admin" on public.stock_reorder_rules;
create policy "stock_reorder_rules_write_admin" on public.stock_reorder_rules
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

create index if not exists stock_reorder_rules_product_idx on public.stock_reorder_rules (product_id);

-- 2) Supplier orders (draft screen where suggestions become lines)
do $enum_supplier_order_status$
begin
  create type public.supplier_order_status as enum ('draft', 'sent', 'received', 'cancelled');
exception
  when duplicate_object then null;
end
$enum_supplier_order_status$;

create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  order_date date not null,
  supplier text,
  note text,
  status public.supplier_order_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_order_lines (
  id uuid primary key default gen_random_uuid(),
  supplier_order_id uuid not null references public.supplier_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  variant_segment text not null,
  size_label text not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

alter table public.supplier_order_lines
  drop constraint if exists supplier_order_lines_variant_segment_check;
alter table public.supplier_order_lines
  add constraint supplier_order_lines_variant_segment_check
  check (variant_segment in ('youth', 'adult'));

alter table public.supplier_orders enable row level security;
alter table public.supplier_order_lines enable row level security;

drop trigger if exists supplier_orders_set_updated_at on public.supplier_orders;
create trigger supplier_orders_set_updated_at
before update on public.supplier_orders
for each row execute function public.set_updated_at();

drop policy if exists "supplier_orders_select_admin" on public.supplier_orders;
create policy "supplier_orders_select_admin" on public.supplier_orders
  for select
  using (public.has_permission('stock:read'));

drop policy if exists "supplier_orders_write_admin" on public.supplier_orders;
create policy "supplier_orders_write_admin" on public.supplier_orders
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

drop policy if exists "supplier_order_lines_select_admin" on public.supplier_order_lines;
create policy "supplier_order_lines_select_admin" on public.supplier_order_lines
  for select
  using (public.has_permission('stock:read'));

drop policy if exists "supplier_order_lines_write_admin" on public.supplier_order_lines;
create policy "supplier_order_lines_write_admin" on public.supplier_order_lines
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

create index if not exists supplier_orders_date_idx on public.supplier_orders (order_date desc, created_at desc);
create index if not exists supplier_order_lines_order_idx on public.supplier_order_lines (supplier_order_id);
create index if not exists supplier_order_lines_product_idx on public.supplier_order_lines (product_id);

