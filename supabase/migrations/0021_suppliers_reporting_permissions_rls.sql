-- Leveranciers: RLS op expliciete suppliers:* permissies, met terugval op settings:* (bestaande accounts).
--
-- Let op: deze migratie gaat uit van `public.suppliers` (zie 0019_suppliers.sql).
-- In sommige omgevingen worden migraties niet strikt op volgorde gedraaid; voorkom dan 42P01.

do $preflight$
begin
  if to_regclass('public.suppliers') is null then
    raise exception 'missing table public.suppliers; run migration 0019_suppliers.sql first.';
  end if;
end;
$preflight$;

drop policy if exists "suppliers_select_admin" on public.suppliers;
create policy "suppliers_select_admin" on public.suppliers
  for select
  using (
    public.has_permission('dashboard:access')
    or public.has_permission('suppliers:read')
    or public.has_permission('suppliers:write')
    or public.has_permission('settings:read')
    or public.has_permission('stock:write')
  );

drop policy if exists "suppliers_write_admin" on public.suppliers;
create policy "suppliers_write_admin" on public.suppliers
  for all
  using (
    public.has_permission('dashboard:access')
    or public.has_permission('suppliers:write')
    or public.has_permission('settings:write')
  )
  with check (
    public.has_permission('dashboard:access')
    or public.has_permission('suppliers:write')
    or public.has_permission('settings:write')
  );
