-- YOUTH / ADULT als aparte voorraadlijnen (eigen model + maten per product).

alter table public.stock_batches
  add column if not exists variant_segment text;

alter table public.stock_batches
  drop constraint if exists stock_batches_variant_segment_check;

alter table public.stock_batches
  add constraint stock_batches_variant_segment_check
  check (variant_segment is null or variant_segment in ('youth', 'adult'));

create index if not exists stock_batches_product_variant_idx
  on public.stock_batches (product_id, variant_segment);

alter table public.order_items
  add column if not exists variant_segment text,
  add column if not exists size_label text;

alter table public.order_items
  drop constraint if exists order_items_variant_segment_check;

alter table public.order_items
  add constraint order_items_variant_segment_check
  check (variant_segment is null or variant_segment in ('youth', 'adult'));

-- FIFO-consumptie met optioneel variant + maat (legacy: beide null → alleen batches zonder variant/maat).
drop function if exists public.consume_stock_fifo(uuid, integer, text);

create or replace function public.consume_stock_fifo(
  p_product_id uuid,
  p_quantity integer,
  p_reason text default 'sale',
  p_variant text default null,
  p_size text default null
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

    insert into public.stock_consumptions (product_id, stock_batch_id, quantity, reason)
    values (p_product_id, b.id, take_qty, coalesce(p_reason, 'sale'));

    remaining := remaining - take_qty;
  end loop;

  if remaining > 0 then
    raise exception 'insufficient stock';
  end if;
end;
$$;

grant execute on function public.consume_stock_fifo(uuid, integer, text, text, text) to service_role;

create or replace function public.finalize_order_after_mollie_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  li record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;

  if o.status = 'paid' then
    return;
  end if;

  if o.status is distinct from 'pending_payment'::public.order_status then
    raise exception 'order % has invalid status % for finalize', p_order_id, o.status;
  end if;

  for li in
    select product_id, quantity, variant_segment, size_label
    from public.order_items
    where order_id = p_order_id
  loop
    if li.product_id is null then
      raise exception 'order line without product_id';
    end if;
    perform public.consume_stock_fifo(
      li.product_id,
      li.quantity,
      'sale',
      li.variant_segment,
      li.size_label
    );
  end loop;

  update public.orders
  set status = 'paid'::public.order_status,
      fulfillment_error = null,
      updated_at = now()
  where id = p_order_id;
end;
$$;

grant execute on function public.finalize_order_after_mollie_payment(uuid) to service_role;
