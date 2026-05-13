-- Product sets (productsets): een product dat een bundel is van andere bestaande producten.
-- - products.is_set boolean: markeert een product als set
-- - public.product_set_components: componenten (kind-producten) van een set met aantal en volgorde
-- - order_items.set_order_item_id: nullable FK naar een set-regel in dezelfde order; component-regels
--   krijgen unit_price_cents = 0 en consumeren wel de voorraad. De set-regel heeft de verkoopprijs.

-- 1) Markering op products
alter table public.products
  add column if not exists is_set boolean not null default false;

comment on column public.products.is_set is
  'Indien true: dit product is een set/bundel van andere producten. Maat en voorraad worden per component beheerd; verkoopprijs is van de set zelf.';

-- 2) Componenten-tabel
create table if not exists public.product_set_components (
  id uuid primary key default gen_random_uuid(),
  set_product_id uuid not null references public.products (id) on delete cascade,
  component_product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  sort_order integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (set_product_id <> component_product_id)
);

create index if not exists product_set_components_set_idx
  on public.product_set_components (set_product_id, sort_order);
create index if not exists product_set_components_comp_idx
  on public.product_set_components (component_product_id);

alter table public.product_set_components enable row level security;

-- Public read: zichtbaar zolang de set zelf actief is (shop kan dan componenten ophalen)
drop policy if exists "psc_select_public" on public.product_set_components;
create policy "psc_select_public" on public.product_set_components
  for select
  using (
    exists (
      select 1 from public.products p
      where p.id = set_product_id and p.active = true
    )
  );

drop policy if exists "psc_select_admin" on public.product_set_components;
create policy "psc_select_admin" on public.product_set_components
  for select
  using (public.has_permission('products:read'));

drop policy if exists "psc_write_admin" on public.product_set_components;
create policy "psc_write_admin" on public.product_set_components
  for all
  using (public.has_permission('products:write'))
  with check (public.has_permission('products:write'));

drop trigger if exists product_set_components_set_updated_at on public.product_set_components;
create trigger product_set_components_set_updated_at
before update on public.product_set_components
for each row execute function public.set_updated_at();

-- 3) Publieke leesbaarheid voor componenten:
-- Componenten kunnen "intern" (active = false) zijn maar moeten in de shop tóch leesbaar zijn
-- om de set-pagina te kunnen renderen (naam, maten, etc.). We staan leesrechten toe als het
-- product een component is van een actieve set.
drop policy if exists "products_select_public_via_active_set" on public.products;
create policy "products_select_public_via_active_set" on public.products
  for select
  using (
    exists (
      select 1
      from public.product_set_components psc
      join public.products sp on sp.id = psc.set_product_id
      where psc.component_product_id = public.products.id
        and sp.active = true
    )
  );

-- 4) order_items: link van een component-regel naar de set-regel binnen dezelfde order.
alter table public.order_items
  add column if not exists set_order_item_id uuid;

alter table public.order_items
  drop constraint if exists order_items_set_order_item_id_fkey;

alter table public.order_items
  add constraint order_items_set_order_item_id_fkey
  foreign key (set_order_item_id)
  references public.order_items (id)
  on delete cascade;

create index if not exists order_items_set_order_item_id_idx
  on public.order_items (set_order_item_id);

comment on column public.order_items.set_order_item_id is
  'Indien gevuld: deze order_item is een component van de set-orderregel met dit id. De set-regel zelf bevat de verkoopprijs; component-regels hebben unit_price_cents=0 en consumeren wel voorraad (FIFO).';
