-- Fix for older schemas missing stock_batches.quantity_received.
-- Required by "Voorraad → Nieuwe levering" insert logic.

do $$
begin
  if to_regclass('public.stock_batches') is null then
    raise notice '0030: public.stock_batches does not exist, skipping.';
    return;
  end if;

  alter table public.stock_batches
    add column if not exists quantity_received integer not null default 0;

  -- Ensure non-negative and remaining <= received.
  alter table public.stock_batches
    drop constraint if exists stock_batches_quantity_received_check;
  alter table public.stock_batches
    add constraint stock_batches_quantity_received_check check (quantity_received >= 0);

  alter table public.stock_batches
    drop constraint if exists stock_batches_remaining_le_received_check;
  alter table public.stock_batches
    add constraint stock_batches_remaining_le_received_check check (quantity_remaining <= quantity_received);
end $$;

