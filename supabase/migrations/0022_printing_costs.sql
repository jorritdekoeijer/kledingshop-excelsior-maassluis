-- Bedrukkingskosten (extern): standaard per product + opslag per voorraadbatch.
--
-- Eisen:
-- - Gebruiker vult bij levering de basis-inkoopprijs (factuur) in.
-- - Bedrukkingskosten worden automatisch toegevoegd voor kostprijs/rapportage/voorraadwaarde,
--   maar tellen NIET mee in factuurcontrole van de levering.

-- Preflight: vereiste tabellen/kolommen moeten bestaan.
do $preflight$
begin
  if to_regclass('public.products') is null then
    raise exception 'missing table public.products; run core migrations first (e.g. 0002_core_schema.sql + product migrations).';
  end if;
  if to_regclass('public.stock_batches') is null then
    raise exception 'missing table public.stock_batches; run stock migrations first (e.g. 0002_core_schema.sql).';
  end if;
  if to_regclass('public.stock_consumptions') is null then
    raise exception 'missing table public.stock_consumptions; run FIFO migration first (0003_product_images_and_fifo.sql).';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_consumptions'
      and column_name = 'reason'
  ) then
    raise exception 'missing column stock_consumptions.reason; run 0003_product_images_and_fifo.sql (newer schema) first.';
  end if;
  if to_regclass('public.internal_orders') is null or to_regclass('public.internal_order_lines') is null then
    raise exception 'missing internal orders tables; run 0017_internal_orders.sql first.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_batches'
      and column_name = 'unit_purchase_excl_cents'
  ) then
    raise exception 'missing column stock_batches.unit_purchase_excl_cents; run 0015_stock_deliveries.sql first.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_batches'
      and column_name = 'variant_segment'
  ) then
    raise exception 'missing column stock_batches.variant_segment; run 0016_stock_variant_segment.sql first.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_batches'
      and column_name = 'size_label'
  ) then
    raise exception 'missing column stock_batches.size_label; run 0015_stock_deliveries.sql first.';
  end if;
end;
$preflight$;

-- 1) Product: standaard bedrukkingskosten (excl. btw) per stuk
alter table public.products
  add column if not exists printing_excl_cents integer not null default 0;

alter table public.products
  drop constraint if exists products_printing_excl_check;

alter table public.products
  add constraint products_printing_excl_check check (printing_excl_cents >= 0);

comment on column public.products.printing_excl_cents is
  'Standaard bedrukkingskosten per stuk (excl. btw). Wordt bij levering als default toegevoegd aan batch-kostprijs.';

-- 2) Stock batches: bedrukkingsdeel per stuk (excl. btw) apart opslaan
alter table public.stock_batches
  add column if not exists unit_printing_excl_cents integer not null default 0;

alter table public.stock_batches
  drop constraint if exists stock_batches_unit_printing_check;

alter table public.stock_batches
  add constraint stock_batches_unit_printing_check check (unit_printing_excl_cents >= 0);

comment on column public.stock_batches.unit_printing_excl_cents is
  'Bedrukkingskosten per stuk (excl. btw) voor deze batch. Telt mee in kostprijs/rapportage, niet in factuur.';

-- 3) Internal orders: kostprijs = basis + bedrukking
-- Vervang functie als hij bestaat (idempotent).
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
  v_line_total integer;
  v_avg_unit integer;
  remaining integer;
  b record;
  take_qty integer;
  v_unit_total integer;
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

    remaining := v_qty;
    v_line_total := 0;

    for b in
      select id, quantity_remaining, unit_purchase_excl_cents, unit_printing_excl_cents
      from public.stock_batches
      where product_id = v_product_id
        and quantity_remaining > 0
        and variant_segment = v_variant
        and trim(coalesce(size_label, '')) = v_size
      order by received_at asc, created_at asc
      for update
    loop
      exit when remaining <= 0;
      take_qty := least(remaining, b.quantity_remaining);

      if b.unit_purchase_excl_cents is null then
        raise exception 'missing unit_purchase_excl_cents on stock batch %', b.id;
      end if;

      v_unit_total := b.unit_purchase_excl_cents + coalesce(b.unit_printing_excl_cents, 0);

      update public.stock_batches
      set quantity_remaining = quantity_remaining - take_qty
      where id = b.id;

      insert into public.stock_consumptions (product_id, stock_batch_id, quantity, reason)
      values (v_product_id, b.id, take_qty, 'internal_order');

      v_line_total := v_line_total + (take_qty * v_unit_total);
      remaining := remaining - take_qty;
    end loop;

    if remaining > 0 then
      raise exception 'insufficient stock';
    end if;

    v_total := v_total + v_line_total;
    v_avg_unit := round(v_line_total::numeric / v_qty::numeric)::integer;

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
      v_avg_unit,
      v_line_total
    );
  end loop;

  update public.internal_orders
  set total_purchase_excl_cents = v_total
  where id = v_order_id;

  return v_order_id;
end;
$$;

