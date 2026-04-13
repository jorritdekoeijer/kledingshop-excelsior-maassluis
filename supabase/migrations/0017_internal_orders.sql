-- Interne bestellingen: afboeken voorraad met kostengroep + toelichting.

-- Preflight: core tabellen moeten bestaan voor FK's en voorraad-afboeking.
do $preflight$
begin
  if to_regclass('public.products') is null then
    raise exception 'missing table public.products; run core migrations first (e.g. 0002_core_schema.sql + product migrations).';
  end if;
  if to_regclass('public.stock_batches') is null then
    raise exception 'missing table public.stock_batches; run stock migrations first.';
  end if;
end;
$preflight$;

-- Dependency safety: sommige omgevingen missen `cost_groups` (bijv. als niet alle core-migraties zijn gedraaid).
--
-- Ook `public.has_permission(text)` kan ontbreken. We definiëren een compatibele variant zonder harde compile-time
-- dependency op `public.user_profiles` (dynamic SQL).
create or replace function public.has_permission(required_permission text)
returns boolean
language plpgsql
stable
as $$
declare
  ok boolean := false;
begin
  -- Service role bypass (Supabase)
  begin
    if auth.role() = 'service_role' then
      return true;
    end if;
  exception
    when undefined_function then
      -- auth schema ontbreekt (niet-Supabase); val terug op false/DB policies
      null;
  end;

  if to_regclass('public.user_profiles') is null then
    return false;
  end if;

  execute
    'select exists (select 1 from public.user_profiles up where up.id = auth.uid() and $1 = any (up.permissions))'
  into ok
  using required_permission;

  return coalesce(ok, false);
exception
  when others then
    return false;
end;
$$;

create table if not exists public.cost_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cost_groups enable row level security;

drop trigger if exists cost_groups_set_updated_at on public.cost_groups;
create trigger cost_groups_set_updated_at
before update on public.cost_groups
for each row execute function public.set_updated_at();

drop policy if exists "cost_groups_select_admin" on public.cost_groups;
create policy "cost_groups_select_admin" on public.cost_groups
  for select
  using (public.has_permission('cost_groups:read'));

drop policy if exists "cost_groups_write_admin" on public.cost_groups;
create policy "cost_groups_write_admin" on public.cost_groups
  for all
  using (public.has_permission('cost_groups:write'))
  with check (public.has_permission('cost_groups:write'));

create table if not exists public.internal_orders (
  id uuid primary key default gen_random_uuid(),
  order_date date not null,
  cost_group_id uuid not null references public.cost_groups (id) on delete restrict,
  note text not null,
  total_purchase_excl_cents integer not null default 0 check (total_purchase_excl_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_order_lines (
  id uuid primary key default gen_random_uuid(),
  internal_order_id uuid not null references public.internal_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  variant_segment text,
  size_label text,
  quantity integer not null check (quantity > 0),
  unit_purchase_excl_cents integer not null check (unit_purchase_excl_cents >= 0),
  line_total_purchase_excl_cents integer not null check (line_total_purchase_excl_cents >= 0),
  created_at timestamptz not null default now()
);

alter table public.internal_orders enable row level security;
alter table public.internal_order_lines enable row level security;

drop trigger if exists internal_orders_set_updated_at on public.internal_orders;
create trigger internal_orders_set_updated_at
before update on public.internal_orders
for each row execute function public.set_updated_at();

drop policy if exists "internal_orders_select_admin" on public.internal_orders;
create policy "internal_orders_select_admin" on public.internal_orders
  for select
  using (public.has_permission('stock:read'));

drop policy if exists "internal_orders_write_admin" on public.internal_orders;
create policy "internal_orders_write_admin" on public.internal_orders
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

drop policy if exists "internal_order_lines_select_admin" on public.internal_order_lines;
create policy "internal_order_lines_select_admin" on public.internal_order_lines
  for select
  using (public.has_permission('stock:read'));

drop policy if exists "internal_order_lines_write_admin" on public.internal_order_lines;
create policy "internal_order_lines_write_admin" on public.internal_order_lines
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

alter table public.internal_order_lines
  drop constraint if exists internal_order_lines_variant_segment_check;
alter table public.internal_order_lines
  add constraint internal_order_lines_variant_segment_check
  check (variant_segment is null or variant_segment in ('youth', 'adult'));

create index if not exists internal_orders_date_idx on public.internal_orders (order_date desc, created_at desc);
create index if not exists internal_orders_cost_group_idx on public.internal_orders (cost_group_id);
create index if not exists internal_order_lines_order_idx on public.internal_order_lines (internal_order_id);
create index if not exists internal_order_lines_product_idx on public.internal_order_lines (product_id);

-- Atomic: create internal order + consume stock per line (FIFO).
create or replace function public.create_internal_order_and_consume_stock(
  p_order_date date,
  p_cost_group_id uuid,
  p_note text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total integer := 0;
  li jsonb;
  v_product_id uuid;
  v_qty integer;
  v_variant text;
  v_size text;
  v_unit integer;
  v_line_total integer;
begin
  if not public.has_permission('stock:write') then
    raise exception 'permission denied';
  end if;

  if p_order_date is null then
    raise exception 'order_date is required';
  end if;
  if p_cost_group_id is null then
    raise exception 'cost_group_id is required';
  end if;
  if nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'note is required';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'lines is required';
  end if;

  insert into public.internal_orders (order_date, cost_group_id, note, total_purchase_excl_cents)
  values (p_order_date, p_cost_group_id, trim(p_note), 0)
  returning id into v_order_id;

  for li in select * from jsonb_array_elements(p_lines)
  loop
    v_product_id := nullif(trim(coalesce(li->>'productId', '')), '')::uuid;
    v_qty := (li->>'quantity')::integer;
    v_variant := nullif(trim(coalesce(li->>'variantSegment', '')), '');
    v_size := nullif(trim(coalesce(li->>'sizeLabel', '')), '');
    v_unit := (li->>'unitPurchaseExclCents')::integer;

    if v_product_id is null then
      raise exception 'line missing productId';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'line quantity must be > 0';
    end if;
    if v_variant is null or v_variant not in ('youth', 'adult') then
      raise exception 'line variantSegment must be youth or adult';
    end if;
    if v_size is null then
      raise exception 'line sizeLabel is required';
    end if;
    if v_unit is null or v_unit < 0 then
      raise exception 'line unitPurchaseExclCents must be >= 0';
    end if;

    v_line_total := v_unit * v_qty;
    v_total := v_total + v_line_total;

    insert into public.internal_order_lines (
      internal_order_id,
      product_id,
      variant_segment,
      size_label,
      quantity,
      unit_purchase_excl_cents,
      line_total_purchase_excl_cents
    )
    values (
      v_order_id,
      v_product_id,
      v_variant,
      v_size,
      v_qty,
      v_unit,
      v_line_total
    );

    perform public.consume_stock_fifo(v_product_id, v_qty, 'internal_order', v_variant, v_size);
  end loop;

  update public.internal_orders
  set total_purchase_excl_cents = v_total
  where id = v_order_id;

  return v_order_id;
end;
$$;

grant execute on function public.create_internal_order_and_consume_stock(date, uuid, text, jsonb) to service_role;

