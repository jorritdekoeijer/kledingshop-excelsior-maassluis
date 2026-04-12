-- Uitgebreide productvelden: korting, details, jeugd/volwassen varianten.
-- price_cents blijft de hoofd-verkoopprijs incl. 21% btw (centen).

alter table public.products
  add column if not exists temporary_discount_percent numeric(5, 2) not null default 0
  check (temporary_discount_percent >= 0 and temporary_discount_percent <= 100);

alter table public.products
  add column if not exists product_details jsonb not null default '[]'::jsonb;

alter table public.products
  add column if not exists variant_youth jsonb not null default '{}'::jsonb;

alter table public.products
  add column if not exists variant_adult jsonb not null default '{}'::jsonb;

comment on column public.products.price_cents is 'Verkoopprijs incl. 21% btw (centen)';
comment on column public.products.temporary_discount_percent is 'Korting op incl.-prijs voor weergave en afrekenen (0–100)';
comment on column public.products.product_details is 'Array van {label,value} voor productdetails (kleur, materiaal, …)';
comment on column public.products.variant_youth is 'Jeugd: inkoop/verkoop centen, modelnummer, maten[]';
comment on column public.products.variant_adult is 'Volwassenen: inkoop/verkoop centen, modelnummer, maten[]';
