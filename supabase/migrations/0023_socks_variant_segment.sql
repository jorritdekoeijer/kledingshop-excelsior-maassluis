-- Introduce SOCKS as its own variant segment (youth/adult/socks).
-- Also add products.variant_socks jsonb block.

-- 1) Product variant block for socks
alter table public.products
  add column if not exists variant_socks jsonb not null default '{}'::jsonb;

comment on column public.products.variant_socks is 'Sokken: inkoop/verkoop centen, modelnummer, maten[]';

-- 2) Expand variant_segment checks to include socks
alter table public.stock_batches
  drop constraint if exists stock_batches_variant_segment_check;
alter table public.stock_batches
  add constraint stock_batches_variant_segment_check
  check (variant_segment is null or variant_segment in ('youth', 'adult', 'socks'));

alter table public.order_items
  drop constraint if exists order_items_variant_segment_check;
alter table public.order_items
  add constraint order_items_variant_segment_check
  check (variant_segment is null or variant_segment in ('youth', 'adult', 'socks'));

alter table public.stock_reorder_rules
  drop constraint if exists stock_reorder_rules_variant_segment_check;
alter table public.stock_reorder_rules
  add constraint stock_reorder_rules_variant_segment_check
  check (variant_segment in ('youth', 'adult', 'socks'));

alter table public.supplier_order_lines
  drop constraint if exists supplier_order_lines_variant_segment_check;
alter table public.supplier_order_lines
  add constraint supplier_order_lines_variant_segment_check
  check (variant_segment in ('youth', 'adult', 'socks'));

alter table public.internal_order_lines
  drop constraint if exists internal_order_lines_variant_segment_check;
alter table public.internal_order_lines
  add constraint internal_order_lines_variant_segment_check
  check (variant_segment is null or variant_segment in ('youth', 'adult', 'socks'));

