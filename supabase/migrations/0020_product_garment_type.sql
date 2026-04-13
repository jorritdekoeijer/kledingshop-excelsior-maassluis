-- Kleding vs. sokken: bepaalt welke maatlijst voor YOUTH/ADULT wordt gebruikt (dashboard + shop).

alter table public.products
  add column if not exists garment_type text not null default 'clothing';

alter table public.products drop constraint if exists products_garment_type_check;

alter table public.products
  add constraint products_garment_type_check check (garment_type in ('clothing', 'socks'));

comment on column public.products.garment_type is 'clothing: jeugd/volwassen maatlijsten; socks: vaste sokkenmaten voor beide segmenten.';
