-- Order pickup workflow:
-- - After Mollie paid: status -> new_order (paid_at set), confirmation email
-- - Dashboard picks (per order_item): consume FIFO on pick
-- - Ready for pickup: status -> ready_for_pickup + pickup email (complete/incomplete)
-- - Picked up: if all picked -> completed, else backorder (returns to "Te maken")

-- 1) Extend order_status enum
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'order_status' and e.enumlabel = 'new_order') then
    alter type public.order_status add value 'new_order';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'order_status' and e.enumlabel = 'ready_for_pickup') then
    alter type public.order_status add value 'ready_for_pickup';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'order_status' and e.enumlabel = 'backorder') then
    alter type public.order_status add value 'backorder';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'order_status' and e.enumlabel = 'completed') then
    alter type public.order_status add value 'completed';
  end if;
end
$$;

-- 2) Orders: order number + payment/pickup timestamps
create sequence if not exists public.order_number_seq;

alter table public.orders
  add column if not exists order_number text,
  add column if not exists paid_at timestamptz,
  add column if not exists pickup_email_sent_at timestamptz,
  add column if not exists pickup_email_kind text;

create unique index if not exists orders_order_number_uq on public.orders (order_number);

comment on column public.orders.order_number is 'Human-friendly order number (generated on insert).';
comment on column public.orders.paid_at is 'Timestamp when Mollie payment succeeded.';
comment on column public.orders.pickup_email_kind is 'complete|incomplete';

create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if new.order_number is null or trim(new.order_number) = '' then
    n := nextval('public.order_number_seq');
    new.order_number := 'EM-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_order_number on public.orders;
create trigger orders_assign_order_number
before insert on public.orders
for each row execute function public.assign_order_number();

-- 3) Order items: picked state (physical pick from stock)
alter table public.order_items
  add column if not exists picked boolean not null default false,
  add column if not exists picked_at timestamptz,
  add column if not exists delivered boolean not null default false,
  add column if not exists delivered_at timestamptz;

comment on column public.order_items.picked is 'True when item is picked/packed for this order.';
comment on column public.order_items.delivered is 'True when item is handed to customer.';

-- 4) Replace finalize_order_after_mollie_payment:
--    do NOT consume stock here anymore; picking consumes stock.
create or replace function public.finalize_order_after_mollie_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;

  -- idempotent: if already marked paid/new_order, do nothing
  if o.status in ('new_order'::public.order_status, 'ready_for_pickup'::public.order_status, 'backorder'::public.order_status, 'completed'::public.order_status) then
    return;
  end if;

  if o.status is distinct from 'pending_payment'::public.order_status then
    raise exception 'order % has invalid status % for finalize', p_order_id, o.status;
  end if;

  update public.orders
  set status = 'new_order'::public.order_status,
      paid_at = coalesce(paid_at, now()),
      fulfillment_error = null,
      updated_at = now()
  where id = p_order_id;
end;
$$;

grant execute on function public.finalize_order_after_mollie_payment(uuid) to service_role;

-- 5) Pick an order item: consume FIFO for that line once.
create or replace function public.pick_order_item_and_consume_stock(p_order_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  li record;
begin
  select * into li from public.order_items where id = p_order_item_id for update;
  if not found then
    raise exception 'order item not found';
  end if;
  if li.delivered = true then
    raise exception 'cannot pick delivered item';
  end if;
  if li.picked = true then
    return;
  end if;
  if li.product_id is null then
    raise exception 'order line without product_id';
  end if;

  perform public.consume_stock_fifo(
    li.product_id,
    li.quantity,
    'sale',
    nullif(trim(coalesce(li.variant_segment, '')), ''),
    nullif(trim(coalesce(li.size_label, '')), '')
  );

  update public.order_items
  set picked = true,
      picked_at = now()
  where id = p_order_item_id;
end;
$$;

grant execute on function public.pick_order_item_and_consume_stock(uuid) to service_role;

