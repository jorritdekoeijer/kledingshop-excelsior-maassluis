-- Store invoice total (incl. VAT) on stock deliveries for reporting/overview.

alter table public.stock_deliveries
  add column if not exists invoice_total_incl_cents integer;

alter table public.stock_deliveries
  drop constraint if exists stock_deliveries_invoice_total_check;

alter table public.stock_deliveries
  add constraint stock_deliveries_invoice_total_check
  check (invoice_total_incl_cents is null or invoice_total_incl_cents >= 0);

comment on column public.stock_deliveries.invoice_total_incl_cents is
  'Factuurbedrag incl. btw (centen), optioneel ter controle/overzicht.';

