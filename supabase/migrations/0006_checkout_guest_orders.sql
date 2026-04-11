-- Guest checkout: adresgegevens, publieke bedankt-token, foutafhandeling, atomische afhandeling na betaling.

alter table public.orders
  add column if not exists guest_email text,
  add column if not exists guest_name text,
  add column if not exists guest_phone text,
  add column if not exists shipping_address jsonb not null default '{}'::jsonb,
  add column if not exists public_token uuid not null default gen_random_uuid(),
  add column if not exists fulfillment_error text;

create unique index if not exists orders_public_token_uq on public.orders (public_token);

-- Atomisch: FIFO-voorraad afboeken en order op 'paid' zetten (idempotent als al paid).
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
    select product_id, quantity
    from public.order_items
    where order_id = p_order_id
  loop
    if li.product_id is null then
      raise exception 'order line without product_id';
    end if;
    perform public.consume_stock_fifo(li.product_id, li.quantity, 'sale');
  end loop;

  update public.orders
  set status = 'paid'::public.order_status,
      fulfillment_error = null,
      updated_at = now()
  where id = p_order_id;
end;
$$;

grant execute on function public.finalize_order_after_mollie_payment(uuid) to service_role;

comment on function public.finalize_order_after_mollie_payment(uuid) is
  'Na succesvolle Mollie-betaling: FIFO-voorraad afboeken en order op paid. Idempotent.';

-- RLS: dashboard:access mag orders bekijken/bewerken (zelfde idee als in de Next.js-app).
drop policy if exists "orders_select_admin" on public.orders;
create policy "orders_select_admin" on public.orders
  for select
  using (
    public.has_permission('orders:read')
    or public.has_permission('dashboard:access')
  );

drop policy if exists "orders_write_admin" on public.orders;
create policy "orders_write_admin" on public.orders
  for all
  using (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
  )
  with check (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
  );

drop policy if exists "order_items_select_admin" on public.order_items;
create policy "order_items_select_admin" on public.order_items
  for select
  using (
    public.has_permission('orders:read')
    or public.has_permission('dashboard:access')
  );

drop policy if exists "order_items_write_admin" on public.order_items;
create policy "order_items_write_admin" on public.order_items
  for all
  using (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
  )
  with check (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
  );

drop policy if exists "mollie_payments_select_admin" on public.mollie_payments;
create policy "mollie_payments_select_admin" on public.mollie_payments
  for select
  using (
    public.has_permission('orders:read')
    or public.has_permission('dashboard:access')
  );

drop policy if exists "mollie_payments_write_admin" on public.mollie_payments;
create policy "mollie_payments_write_admin" on public.mollie_payments
  for all
  using (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
  )
  with check (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
  );
