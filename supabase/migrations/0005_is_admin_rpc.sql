-- Admin-check voor middleware / server zonder afhankelijk van RLS op user_roles bij complexe policies.
-- SECURITY DEFINER + auth.uid(): veilig; alleen eigen rol wordt gezien.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'::public.app_role
  );
$$;

revoke all on function public.is_admin() from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
