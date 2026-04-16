-- Allow granular access to order dashboards (pick / pickup) via permissions.

do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'missing table public.orders';
  end if;
  if to_regclass('public.order_items') is null then
    raise exception 'missing table public.order_items';
  end if;
end
$$;

-- ORDERS: select
drop policy if exists "orders_select_admin" on public.orders;
create policy "orders_select_admin" on public.orders
  for select
  using (
    public.has_permission('orders:read')
    or public.has_permission('dashboard:access')
    or public.has_permission('order_pick:read')
    or public.has_permission('order_pickup:read')
  );

-- ORDERS: write
drop policy if exists "orders_write_admin" on public.orders;
create policy "orders_write_admin" on public.orders
  for all
  using (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
    or public.has_permission('order_pick:write')
    or public.has_permission('order_pickup:write')
  )
  with check (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
    or public.has_permission('order_pick:write')
    or public.has_permission('order_pickup:write')
  );

-- ORDER_ITEMS: select
drop policy if exists "order_items_select_admin" on public.order_items;
create policy "order_items_select_admin" on public.order_items
  for select
  using (
    public.has_permission('orders:read')
    or public.has_permission('dashboard:access')
    or public.has_permission('order_pick:read')
    or public.has_permission('order_pickup:read')
  );

-- ORDER_ITEMS: write
drop policy if exists "order_items_write_admin" on public.order_items;
create policy "order_items_write_admin" on public.order_items
  for all
  using (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
    or public.has_permission('order_pick:write')
    or public.has_permission('order_pickup:write')
  )
  with check (
    public.has_permission('orders:write')
    or public.has_permission('dashboard:access')
    or public.has_permission('order_pick:write')
    or public.has_permission('order_pickup:write')
  );

