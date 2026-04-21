-- Ensure RLS policies exist for stock_batches (and stock_deliveries).
-- Some environments can end up with the tables but missing policies, causing "0 rows" in the app.

do $$
begin
  if to_regclass('public.stock_batches') is not null then
    alter table public.stock_batches enable row level security;

    drop policy if exists "stock_batches_select_admin" on public.stock_batches;
    create policy "stock_batches_select_admin" on public.stock_batches
      for select
      using (public.has_permission('stock:read'));

    drop policy if exists "stock_batches_write_admin" on public.stock_batches;
    create policy "stock_batches_write_admin" on public.stock_batches
      for all
      using (public.has_permission('stock:write'))
      with check (public.has_permission('stock:write'));
  end if;

  if to_regclass('public.stock_deliveries') is not null then
    alter table public.stock_deliveries enable row level security;

    drop policy if exists "stock_deliveries_select_admin" on public.stock_deliveries;
    create policy "stock_deliveries_select_admin" on public.stock_deliveries
      for select
      using (public.has_permission('stock:read'));

    drop policy if exists "stock_deliveries_write_admin" on public.stock_deliveries;
    create policy "stock_deliveries_write_admin" on public.stock_deliveries
      for all
      using (public.has_permission('stock:write'))
      with check (public.has_permission('stock:write'));
  end if;
end $$;

