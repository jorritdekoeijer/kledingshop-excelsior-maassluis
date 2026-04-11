-- E-mailbevestiging na betaling (idempotent via timestamp).

alter table public.orders
  add column if not exists confirmation_sent_at timestamptz;

comment on column public.orders.confirmation_sent_at is
  'Gezet zodra de klant een bevestigingsmail heeft gekregen (webhook na betaling).';
