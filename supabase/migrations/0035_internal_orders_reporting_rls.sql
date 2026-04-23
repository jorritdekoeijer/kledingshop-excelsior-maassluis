-- Allow reporting users to read internal orders for the financial report.
-- Without this, users with reporting:read but without stock:read would see 0 internal orders.

do $$
begin
  if to_regclass('public.internal_orders') is not null then
    alter table public.internal_orders enable row level security;
    drop policy if exists "internal_orders_select_admin" on public.internal_orders;
    create policy "internal_orders_select_admin" on public.internal_orders
      for select
      using (
        public.has_permission('stock:read')
        or public.has_permission('reporting:read')
        or public.has_permission('reporting:write')
      );
  end if;

  if to_regclass('public.internal_order_lines') is not null then
    alter table public.internal_order_lines enable row level security;
    drop policy if exists "internal_order_lines_select_admin" on public.internal_order_lines;
    create policy "internal_order_lines_select_admin" on public.internal_order_lines
      for select
      using (
        public.has_permission('stock:read')
        or public.has_permission('reporting:read')
        or public.has_permission('reporting:write')
      );
  end if;
end $$;

