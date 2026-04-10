-- Multiple product images + FIFO stock consumption function.

-- 1) Product images
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists product_images_product_path_uq
  on public.product_images (product_id, path);

create index if not exists product_images_product_sort_idx
  on public.product_images (product_id, is_primary desc, sort_order asc, created_at asc);

alter table public.product_images enable row level security;

create policy "product_images_select_public" on public.product_images
  for select
  using (true);

create policy "product_images_write_admin" on public.product_images
  for all
  using (public.has_permission('products:write'))
  with check (public.has_permission('products:write'));

-- Ensure only one primary image per product
create unique index if not exists product_images_one_primary_per_product
  on public.product_images (product_id)
  where (is_primary = true);

-- Backfill from products.image_path (legacy single image)
insert into public.product_images (product_id, path, sort_order, is_primary)
select p.id, p.image_path, 0, true
from public.products p
where p.image_path is not null
on conflict do nothing;

-- 2) FIFO stock consumption
-- This function consumes stock from oldest batches first and records decrements.
create table if not exists public.stock_consumptions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  stock_batch_id uuid not null references public.stock_batches (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  reason text not null default 'sale',
  created_at timestamptz not null default now()
);

alter table public.stock_consumptions enable row level security;

create policy "stock_consumptions_select_admin" on public.stock_consumptions
  for select
  using (public.has_permission('stock:read'));

create policy "stock_consumptions_write_admin" on public.stock_consumptions
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

create or replace function public.consume_stock_fifo(p_product_id uuid, p_quantity integer, p_reason text default 'sale')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer := p_quantity;
  b record;
  take_qty integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;

  -- Lock candidate batches in FIFO order
  for b in
    select id, quantity_remaining
    from public.stock_batches
    where product_id = p_product_id
      and quantity_remaining > 0
    order by received_at asc, created_at asc
    for update
  loop
    exit when remaining <= 0;
    take_qty := least(remaining, b.quantity_remaining);

    update public.stock_batches
    set quantity_remaining = quantity_remaining - take_qty
    where id = b.id;

    insert into public.stock_consumptions (product_id, stock_batch_id, quantity, reason)
    values (p_product_id, b.id, take_qty, coalesce(p_reason, 'sale'));

    remaining := remaining - take_qty;
  end loop;

  if remaining > 0 then
    raise exception 'insufficient stock';
  end if;
end;
$$;

