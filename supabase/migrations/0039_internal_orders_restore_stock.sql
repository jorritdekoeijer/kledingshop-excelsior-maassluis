-- Restore stock for an internal order that was cancelled without restocking (legacy bug scenario).
-- Safe to run only once: sets internal_orders.stock_restored_at and prevents re-running.

do $$
begin
  if to_regclass('public.internal_orders') is null then
    raise notice '0039: public.internal_orders does not exist, skipping.';
    return;
  end if;

  alter table public.internal_orders
    add column if not exists stock_restored_at timestamptz;
end $$;

create or replace function public.restore_internal_order_stock(
  p_internal_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  l record;
  v_qty integer;
  v_initial integer;
  v_left integer;
  b record;
  take_qty integer;
  has_linked_consumptions boolean := false;
begin
  if not public.has_permission('stock:write') then
    raise exception 'permission denied';
  end if;
  if p_internal_order_id is null then
    raise exception 'internal_order_id is required';
  end if;

  -- Lock the order row and prevent double restore.
  perform 1 from public.internal_orders where id = p_internal_order_id for update;
  if not found then
    raise exception 'internal order not found';
  end if;
  if exists (select 1 from public.internal_orders where id = p_internal_order_id and stock_restored_at is not null) then
    raise exception 'stock already restored';
  end if;

  -- Preferred path: revert linked consumptions (exact batches) when they exist.
  if to_regclass('public.stock_consumptions') is not null and
     exists (
       select 1
       from information_schema.columns
       where table_schema='public' and table_name='stock_consumptions' and column_name='internal_order_id'
     ) then
    select exists(
      select 1
      from public.stock_consumptions sc
      where sc.internal_order_id = p_internal_order_id
        and sc.reason = 'internal_order'
    ) into has_linked_consumptions;

    if has_linked_consumptions then
      for c in
        select sc.stock_batch_id, sc.quantity
        from public.stock_consumptions sc
        where sc.internal_order_id = p_internal_order_id
          and sc.reason = 'internal_order'
        for update
      loop
        v_qty := coalesce(c.quantity, 0);
        if v_qty <= 0 then
          continue;
        end if;

        begin
          select quantity_initial into v_initial from public.stock_batches where id = c.stock_batch_id for update;
          update public.stock_batches
          set quantity_remaining = least(quantity_initial, quantity_remaining + v_qty)
          where id = c.stock_batch_id;
        exception
          when undefined_column then
            update public.stock_batches
            set quantity_remaining = quantity_remaining + v_qty
            where id = c.stock_batch_id;
        end;
      end loop;

      -- Remove those consumptions so they don't linger.
      delete from public.stock_consumptions
      where internal_order_id = p_internal_order_id
        and reason = 'internal_order';
    end if;
  end if;

  -- Fallback: restock by internal_order_lines (best effort).
  if not has_linked_consumptions then
    for l in
      select product_id, variant_segment, size_label, quantity
      from public.internal_order_lines
      where internal_order_id = p_internal_order_id
    loop
      v_left := coalesce(l.quantity, 0);
      if v_left <= 0 then
        continue;
      end if;

      for b in
        select id
        from public.stock_batches
        where product_id = l.product_id
          and trim(coalesce(variant_segment, '')) = trim(coalesce(l.variant_segment, ''))
          and trim(coalesce(size_label, '')) = trim(coalesce(l.size_label, ''))
        order by received_at desc nulls last, created_at desc
        for update
      loop
        exit when v_left <= 0;
        take_qty := v_left;

        begin
          select quantity_initial into v_initial from public.stock_batches where id = b.id;
          update public.stock_batches
          set quantity_remaining = least(quantity_initial, quantity_remaining + take_qty)
          where id = b.id;
        exception
          when undefined_column then
            update public.stock_batches
            set quantity_remaining = quantity_remaining + take_qty
            where id = b.id;
        end;

        v_left := 0;
      end loop;
    end loop;
  end if;

  update public.internal_orders
  set stock_restored_at = now()
  where id = p_internal_order_id;

  return p_internal_order_id;
end;
$$;

grant execute on function public.restore_internal_order_stock(uuid) to service_role;

