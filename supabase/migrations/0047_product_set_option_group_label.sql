-- Publiek label voor productset-keuzegroepen.
-- option_group blijft de interne key (gebruikt voor groepering en validatie).
-- option_group_label is wat de bezoeker in de webshop te zien krijgt, bv. "Kies je bovenlaag".

alter table public.product_set_components
  add column if not exists option_group_label text;

comment on column public.product_set_components.option_group_label is
  'Publiek zichtbaar label voor de keuzegroep (alleen relevant als option_group is ingevuld). Leeg = val terug op een generieke tekst in de shop.';
