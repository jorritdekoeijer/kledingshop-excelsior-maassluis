-- Fix: cancel_internal_order should fallback to internal_order_lines when no linked stock_consumptions exist.

create or replace function public.cancel_internal_order(
  p_internal_order_id uuid,
  p_cancel_note text default ''
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

  -- Lock the order row.
  perform 1 from public.internal_orders where id = p_internal_order_id for update;
  if not found then
    raise exception 'internal order not found';
  end if;

  if exists (select 1 from public.internal_orders where id = p_internal_order_id and cancelled_at is not null) then
    raise exception 'already cancelled';
  end if;

  -- Preferred path: revert linked consumptions (exact batches) when they exist for this order.
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

      delete from public.stock_consumptions
      where internal_order_id = p_internal_order_id
        and reason = 'internal_order';
    end if;
  end if;

  -- Fallback path: for older orders where consumptions are not linked, restock by lines (best effort).
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

  -- Mark cancelled; keep lines for audit, but zero totals so report doesn't count it.
  update public.internal_orders
  set cancelled_at = now(),
      cancelled_note = nullif(trim(coalesce(p_cancel_note, '')), ''),
      total_purchase_excl_cents = 0
  where id = p_internal_order_id;

  return p_internal_order_id;
end;
$$;

grant execute on function public.cancel_internal_order(uuid, text) to service_role;

