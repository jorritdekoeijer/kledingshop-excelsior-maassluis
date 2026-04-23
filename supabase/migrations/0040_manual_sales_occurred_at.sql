-- Manual sales: allow recording the sale date/time for stock_consumptions.
-- Adds stock_consumptions.occurred_at and a helper function consume_stock_fifo_at(...) for manual sales/imports.

do $$
begin
  if to_regclass('public.stock_consumptions') is null then
    raise notice '0040: public.stock_consumptions does not exist, skipping.';
    return;
  end if;

  alter table public.stock_consumptions
    add column if not exists occurred_at timestamptz;

  -- Backfill
  update public.stock_consumptions
  set occurred_at = created_at
  where occurred_at is null;

  alter table public.stock_consumptions
    alter column occurred_at set not null;
end $$;

create or replace function public.consume_stock_fifo_at(
  p_product_id uuid,
  p_quantity integer,
  p_reason text default 'sale',
  p_variant text default null,
  p_size text default null,
  p_occurred_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer := p_quantity;
  b record;
  take_qty integer;
  size_filter text := nullif(trim(coalesce(p_size, '')), '');
  v_when timestamptz := coalesce(p_occurred_at, now());
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;

  for b in
    select id, quantity_remaining
    from public.stock_batches
    where product_id = p_product_id
      and quantity_remaining > 0
      and (
        (p_variant is null and variant_segment is null)
        or (p_variant is not null and variant_segment = p_variant)
      )
      and (
        (size_filter is null and (size_label is null or trim(size_label) = ''))
        or (size_filter is not null and trim(size_label) = size_filter)
      )
    order by received_at asc, created_at asc
    for update
  loop
    exit when remaining <= 0;
    take_qty := least(remaining, b.quantity_remaining);

    update public.stock_batches
    set quantity_remaining = quantity_remaining - take_qty
    where id = b.id;

    insert into public.stock_consumptions (product_id, stock_batch_id, quantity, reason, occurred_at)
    values (p_product_id, b.id, take_qty, coalesce(p_reason, 'sale'), v_when);

    remaining := remaining - take_qty;
  end loop;

  if remaining > 0 then
    raise exception 'insufficient stock';
  end if;
end;
$$;

grant execute on function public.consume_stock_fifo_at(uuid, integer, text, text, text, timestamptz) to service_role;

