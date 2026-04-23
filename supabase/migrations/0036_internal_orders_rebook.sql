-- Allow editing internal order lines by being able to "rebook":
-- - restore quantities to the same stock batches that were consumed
-- - delete old internal_order_lines + consumptions
-- - consume stock again FIFO for the new set of lines

do $$
begin
  if to_regclass('public.stock_consumptions') is null then
    raise notice '0036: public.stock_consumptions does not exist, skipping.';
    return;
  end if;
  if to_regclass('public.internal_orders') is null or to_regclass('public.internal_order_lines') is null then
    raise notice '0036: internal orders tables do not exist, skipping.';
    return;
  end if;

  alter table public.stock_consumptions
    add column if not exists internal_order_id uuid;

  alter table public.stock_consumptions
    drop constraint if exists stock_consumptions_internal_order_id_fkey;
  alter table public.stock_consumptions
    add constraint stock_consumptions_internal_order_id_fkey
    foreign key (internal_order_id) references public.internal_orders (id) on delete set null;

  create index if not exists stock_consumptions_internal_order_id_idx on public.stock_consumptions (internal_order_id);
end $$;

-- Ensure internal order consume function writes the link.
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

      insert into public.stock_consumptions (product_id, stock_batch_id, quantity, reason, internal_order_id)
      values (v_product_id, b.id, take_qty, 'internal_order', v_order_id);

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

-- Rebook: revert old consumptions (by internal_order_id) and consume again for the new lines.
create or replace function public.update_internal_order_and_rebook(
  p_internal_order_id uuid,
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
  c record;
  v_old_qty integer;
  v_initial integer;
begin
  if not public.has_permission('stock:write') then
    raise exception 'permission denied';
  end if;

  if p_internal_order_id is null then
    raise exception 'internal_order_id is required';
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

  -- Lock the order row (prevents concurrent edits).
  perform 1 from public.internal_orders where id = p_internal_order_id for update;

  -- 1) Revert previous stock_consumptions linked to this internal order.
  for c in
    select sc.stock_batch_id, sc.quantity
    from public.stock_consumptions sc
    where sc.internal_order_id = p_internal_order_id
      and sc.reason = 'internal_order'
    for update
  loop
    v_old_qty := coalesce(c.quantity, 0);
    if v_old_qty <= 0 then
      continue;
    end if;

    -- Do not exceed quantity_initial (if present). If schema lacks it, just add back.
    begin
      select quantity_initial into v_initial from public.stock_batches where id = c.stock_batch_id for update;
      update public.stock_batches
      set quantity_remaining = least(quantity_initial, quantity_remaining + v_old_qty)
      where id = c.stock_batch_id;
    exception
      when undefined_column then
        update public.stock_batches
        set quantity_remaining = quantity_remaining + v_old_qty
        where id = c.stock_batch_id;
    end;
  end loop;

  delete from public.stock_consumptions
  where internal_order_id = p_internal_order_id
    and reason = 'internal_order';

  delete from public.internal_order_lines
  where internal_order_id = p_internal_order_id;

  -- 2) Update meta
  update public.internal_orders
  set order_date = p_order_date,
      cost_group_id = p_cost_group_id,
      note = trim(p_note),
      total_purchase_excl_cents = 0
  where id = p_internal_order_id;

  -- 3) Consume again FIFO for the new lines
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

      insert into public.stock_consumptions (product_id, stock_batch_id, quantity, reason, internal_order_id)
      values (v_product_id, b.id, take_qty, 'internal_order', p_internal_order_id);

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
      p_internal_order_id,
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
  where id = p_internal_order_id;

  return p_internal_order_id;
end;
$$;

grant execute on function public.update_internal_order_and_rebook(uuid, date, uuid, text, jsonb) to service_role;

