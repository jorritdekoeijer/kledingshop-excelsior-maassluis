-- Fix for schemas where stock_consumptions.order_item_id is NOT NULL.
-- Internal orders (and other non-order consumptions) must be able to insert without an order_item_id.

do $$
begin
  if to_regclass('public.stock_consumptions') is null then
    raise notice '0034: public.stock_consumptions does not exist, skipping.';
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_consumptions'
      and column_name = 'order_item_id'
  ) then
    alter table public.stock_consumptions
      alter column order_item_id drop not null;
  end if;
end $$;

