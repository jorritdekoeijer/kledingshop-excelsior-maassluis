-- Fix for older schemas missing stock_consumptions.product_id.
-- Required by internal orders + FIFO functions which insert (product_id, stock_batch_id, ...).

do $$
begin
  if to_regclass('public.stock_consumptions') is null then
    raise notice '0033: public.stock_consumptions does not exist, skipping.';
    return;
  end if;
  if to_regclass('public.stock_batches') is null then
    raise notice '0033: public.stock_batches does not exist, skipping.';
    return;
  end if;
  if to_regclass('public.products') is null then
    raise notice '0033: public.products does not exist, skipping.';
    return;
  end if;

  alter table public.stock_consumptions
    add column if not exists product_id uuid;

  -- Backfill from the related batch if missing.
  update public.stock_consumptions sc
  set product_id = sb.product_id
  from public.stock_batches sb
  where sc.stock_batch_id = sb.id
    and sc.product_id is null;

  -- Enforce not-null + FK if possible.
  alter table public.stock_consumptions
    alter column product_id set not null;

  alter table public.stock_consumptions
    drop constraint if exists stock_consumptions_product_id_fkey;
  alter table public.stock_consumptions
    add constraint stock_consumptions_product_id_fkey
    foreign key (product_id) references public.products (id) on delete cascade;

  create index if not exists stock_consumptions_product_id_idx on public.stock_consumptions (product_id);
end $$;

