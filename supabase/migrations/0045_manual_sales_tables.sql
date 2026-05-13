-- Handmatige verkopen als eerste-klas records (i.p.v. alleen losse stock_consumptions).
-- Reden: omzet-attribuutie. Voor set-producten kunnen we de set-prijs als omzet boeken
-- terwijl de individuele componenten gewoon voorraad consumeren (FIFO).
-- Voor reguliere producten slaan we de stuksprijs op zodat reporting niet afhankelijk
-- is van product.variant_*.sale_cents (die kunnen later wijzigen).

create table if not exists public.manual_sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.manual_sales is
  'Handmatige verkoop-headers (verkopen buiten de webshop). Voorraad wordt FIFO afgeboekt via stock_consumptions met reason=manual_sale.';

create index if not exists manual_sales_sale_date_idx on public.manual_sales (sale_date desc);

create table if not exists public.manual_sale_lines (
  id uuid primary key default gen_random_uuid(),
  manual_sale_id uuid not null references public.manual_sales (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  is_set boolean not null default false,
  quantity integer not null check (quantity > 0),
  unit_revenue_incl_cents integer not null default 0 check (unit_revenue_incl_cents >= 0),
  variant_segment text,
  size_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.manual_sale_lines is
  'Per regel van een handmatige verkoop. Voor sets staat unit_revenue_incl_cents op de setprijs en is_set=true; componenten worden NIET als aparte regels opgeslagen (alleen als stock_consumptions met manual_sale_line_id).';

create index if not exists manual_sale_lines_sale_idx on public.manual_sale_lines (manual_sale_id);
create index if not exists manual_sale_lines_product_idx on public.manual_sale_lines (product_id);

alter table public.stock_consumptions
  add column if not exists manual_sale_line_id uuid references public.manual_sale_lines (id) on delete set null;

create index if not exists stock_consumptions_manual_sale_line_idx
  on public.stock_consumptions (manual_sale_line_id);

-- RLS
alter table public.manual_sales enable row level security;
alter table public.manual_sale_lines enable row level security;

drop policy if exists "manual_sales_select" on public.manual_sales;
create policy "manual_sales_select" on public.manual_sales
  for select
  using (
    public.has_permission('stock:read')
    or public.has_permission('stock:write')
    or public.has_permission('reporting:read')
    or public.has_permission('reporting:write')
  );

drop policy if exists "manual_sales_write" on public.manual_sales;
create policy "manual_sales_write" on public.manual_sales
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

drop policy if exists "manual_sale_lines_select" on public.manual_sale_lines;
create policy "manual_sale_lines_select" on public.manual_sale_lines
  for select
  using (
    public.has_permission('stock:read')
    or public.has_permission('stock:write')
    or public.has_permission('reporting:read')
    or public.has_permission('reporting:write')
  );

drop policy if exists "manual_sale_lines_write" on public.manual_sale_lines;
create policy "manual_sale_lines_write" on public.manual_sale_lines
  for all
  using (public.has_permission('stock:write'))
  with check (public.has_permission('stock:write'));

-- RPC: consumeer FIFO met optionele manual_sale_line_id zodat we de koppeling kunnen leggen.
-- Hergebruikt consume_stock_fifo_at logica maar markeert de zojuist gemaakte rijen.
create or replace function public.consume_stock_fifo_for_manual_sale_line(
  p_manual_sale_line_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_variant text default null,
  p_size text default null,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer := p_quantity;
  b record;
  take_qty integer;
  size_filter text := nullif(trim(coalesce(p_size, '')), '');
  variant_filter text := nullif(trim(coalesce(p_variant, '')), '');
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;

  for b in
    select id, quantity_remaining
    from public.stock_batches
    where product_id = p_product_id
      and quantity_remaining > 0
      and (
        (variant_filter is null and (variant_segment is null or trim(variant_segment) = ''))
        or (variant_filter is not null and variant_segment = variant_filter)
      )
      and (
        (size_filter is null and (size_label is null or trim(size_label) = ''))
        or (size_filter is not null and trim(size_label) = size_filter)
      )
    order by received_at asc, created_at asc
    for update
  loop
    exit when remaining <= 0;
    take_qty := least(remaining, b.quantity_remaining);

    update public.stock_batches
    set quantity_remaining = quantity_remaining - take_qty
    where id = b.id;

    insert into public.stock_consumptions (
      product_id,
      stock_batch_id,
      quantity,
      reason,
      occurred_at,
      manual_sale_line_id
    )
    values (
      p_product_id,
      b.id,
      take_qty,
      'manual_sale',
      coalesce(p_occurred_at, now()),
      p_manual_sale_line_id
    );

    remaining := remaining - take_qty;
  end loop;

  if remaining > 0 then
    raise exception 'insufficient stock';
  end if;
end;
$$;

grant execute on function public.consume_stock_fifo_for_manual_sale_line(uuid, uuid, integer, text, text, timestamptz) to service_role;
