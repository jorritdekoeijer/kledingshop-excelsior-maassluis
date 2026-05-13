-- Fix infinite recursion in 0043: policy on public.products joined public.products zelf.
-- We vervangen de policy door een SECURITY DEFINER helper-functie die de RLS-check
-- op products omzeilt en alleen kijkt of het product een component is van een actieve set.

drop policy if exists "products_select_public_via_active_set" on public.products;

create or replace function public.is_component_of_active_set(p_product_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.product_set_components psc
    join public.products sp on sp.id = psc.set_product_id
    where psc.component_product_id = p_product_id
      and sp.active = true
  );
$$;

grant execute on function public.is_component_of_active_set(uuid) to anon, authenticated, service_role;

create policy "products_select_public_via_active_set" on public.products
  for select
  using (public.is_component_of_active_set(public.products.id));
