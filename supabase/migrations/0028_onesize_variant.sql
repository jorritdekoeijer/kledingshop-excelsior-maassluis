-- One size as product type + variant segment.

-- 1) Expand garment_type check to include onesize
alter table public.products drop constraint if exists products_garment_type_check;
alter table public.products
  add constraint products_garment_type_check check (garment_type in ('clothing', 'socks', 'shoes', 'onesize'));

comment on column public.products.garment_type is
  'clothing: jeugd/volwassen; socks: sokken; shoes: schoenen; onesize: one size producten.';

-- 2) Add product variant block for onesize
alter table public.products
  add column if not exists variant_onesize jsonb not null default '{}'::jsonb;

comment on column public.products.variant_onesize is 'One size: inkoop/verkoop centen, modelnummer, maten[]';

-- 3) Expand variant_segment checks to include onesize
alter table public.stock_batches
  drop constraint if exists stock_batches_variant_segment_check;
alter table public.stock_batches
  add constraint stock_batches_variant_segment_check
  check (variant_segment is null or variant_segment in ('youth', 'adult', 'socks', 'shoes', 'onesize'));

alter table public.order_items
  drop constraint if exists order_items_variant_segment_check;
alter table public.order_items
  add constraint order_items_variant_segment_check
  check (variant_segment is null or variant_segment in ('youth', 'adult', 'socks', 'shoes', 'onesize'));

alter table public.stock_reorder_rules
  drop constraint if exists stock_reorder_rules_variant_segment_check;
alter table public.stock_reorder_rules
  add constraint stock_reorder_rules_variant_segment_check
  check (variant_segment in ('youth', 'adult', 'socks', 'shoes', 'onesize'));

alter table public.supplier_order_lines
  drop constraint if exists supplier_order_lines_variant_segment_check;
alter table public.supplier_order_lines
  add constraint supplier_order_lines_variant_segment_check
  check (variant_segment in ('youth', 'adult', 'socks', 'shoes', 'onesize'));

alter table public.internal_order_lines
  drop constraint if exists internal_order_lines_variant_segment_check;
alter table public.internal_order_lines
  add constraint internal_order_lines_variant_segment_check
  check (variant_segment is null or variant_segment in ('youth', 'adult', 'socks', 'shoes', 'onesize'));

