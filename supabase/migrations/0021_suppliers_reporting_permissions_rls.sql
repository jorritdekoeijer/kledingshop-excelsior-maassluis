-- Leveranciers: RLS op expliciete suppliers:* permissies, met terugval op settings:* (bestaande accounts).

drop policy if exists "suppliers_select_admin" on public.suppliers;
create policy "suppliers_select_admin" on public.suppliers
  for select
  using (
    public.has_permission('suppliers:read')
    or public.has_permission('suppliers:write')
    or public.has_permission('settings:read')
    or public.has_permission('stock:write')
  );

drop policy if exists "suppliers_write_admin" on public.suppliers;
create policy "suppliers_write_admin" on public.suppliers
  for all
  using (
    public.has_permission('suppliers:write')
    or public.has_permission('settings:write')
  )
  with check (
    public.has_permission('suppliers:write')
    or public.has_permission('settings:write')
  );
