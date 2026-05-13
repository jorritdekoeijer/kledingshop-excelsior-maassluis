-- Productset-keuzegroepen: componenten met dezelfde option_group binnen één set zijn
-- alternatieven (keuze één van). Componenten zonder option_group zijn altijd inbegrepen.
--
-- Voorbeeld: set met 3 vaste artikelen + keuze tussen polo OF jack.
--   - shirt (option_group=NULL)
--   - broek (option_group=NULL)
--   - sokken (option_group=NULL)
--   - polo (option_group='bovenlaag')
--   - jack (option_group='bovenlaag')

alter table public.product_set_components
  add column if not exists option_group text;

comment on column public.product_set_components.option_group is
  'Optionele groepnaam: componenten met dezelfde option_group binnen één set zijn alternatieven (precies één wordt gekozen). NULL = altijd inbegrepen.';

create index if not exists product_set_components_option_group_idx
  on public.product_set_components (set_product_id, option_group);
