-- Fix for schemas where stock_batches.quantity_initial exists but has no default / nulls.
-- New delivery inserts must always write this column.

do $$
begin
  if to_regclass('public.stock_batches') is null then
    raise notice '0031: public.stock_batches does not exist, skipping.';
    return;
  end if;

  -- If missing, add it (older/newer forks may differ).
  alter table public.stock_batches
    add column if not exists quantity_initial integer;

  -- Backfill existing nulls as best-effort.
  update public.stock_batches
  set quantity_initial = coalesce(quantity_received, quantity_remaining, 0)
  where quantity_initial is null;

  -- Enforce not-null + default.
  alter table public.stock_batches
    alter column quantity_initial set default 0;
  alter table public.stock_batches
    alter column quantity_initial set not null;

  alter table public.stock_batches
    drop constraint if exists stock_batches_quantity_initial_check;
  alter table public.stock_batches
    add constraint stock_batches_quantity_initial_check check (quantity_initial >= 0);

  -- Keep invariants sensible if quantity_received exists.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_batches'
      and column_name = 'quantity_received'
  ) then
    alter table public.stock_batches
      drop constraint if exists stock_batches_received_le_initial_check;
    alter table public.stock_batches
      add constraint stock_batches_received_le_initial_check check (quantity_received <= quantity_initial);
  end if;
end $$;

