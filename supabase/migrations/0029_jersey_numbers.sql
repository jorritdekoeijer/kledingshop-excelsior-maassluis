-- Jersey number option (rugnummer) for clothing products.

alter table public.products
  add column if not exists allow_jersey_number boolean not null default false,
  add column if not exists jersey_number_sale_cents integer not null default 0,
  add column if not exists jersey_number_purchase_single_excl_cents integer not null default 0,
  add column if not exists jersey_number_purchase_double_excl_cents integer not null default 0;

alter table public.products
  drop constraint if exists products_jersey_number_cents_check;

alter table public.products
  add constraint products_jersey_number_cents_check
  check (
    jersey_number_sale_cents >= 0
    and jersey_number_purchase_single_excl_cents >= 0
    and jersey_number_purchase_double_excl_cents >= 0
  );

comment on column public.products.allow_jersey_number is
  'If true (clothing only): customer can add jersey number in shop.';
comment on column public.products.jersey_number_sale_cents is
  'Sale price incl. VAT (centen) for adding a jersey number (flat fee).';
comment on column public.products.jersey_number_purchase_single_excl_cents is
  'Internal cost excl. VAT (centen) for single digit number (1-9).';
comment on column public.products.jersey_number_purchase_double_excl_cents is
  'Internal cost excl. VAT (centen) for double digit number (10+).';

alter table public.order_items
  add column if not exists jersey_number text,
  add column if not exists jersey_number_sale_cents integer,
  add column if not exists jersey_number_purchase_excl_cents integer;

alter table public.order_items
  drop constraint if exists order_items_jersey_number_cost_check;

alter table public.order_items
  add constraint order_items_jersey_number_cost_check
  check (
    (jersey_number_sale_cents is null or jersey_number_sale_cents >= 0)
    and (jersey_number_purchase_excl_cents is null or jersey_number_purchase_excl_cents >= 0)
  );

comment on column public.order_items.jersey_number is 'Optional jersey number (string digits).';
comment on column public.order_items.jersey_number_sale_cents is 'Charged sale add-on incl. VAT (centen).';
comment on column public.order_items.jersey_number_purchase_excl_cents is 'Internal cost add-on excl. VAT (centen).';

