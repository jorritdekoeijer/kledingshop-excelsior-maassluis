-- Fix: stock_consumptions.occurred_at is NOT NULL but older inserts don't set it.
-- Add a default so internal orders / other flows keep working.

do $$
begin
  if to_regclass('public.stock_consumptions') is null then
    raise notice '0041: public.stock_consumptions does not exist, skipping.';
    return;
  end if;

  -- Backfill any unexpected nulls (should be none, but safe).
  update public.stock_consumptions
  set occurred_at = coalesce(created_at, now())
  where occurred_at is null;

  -- Ensure inserts that don't provide occurred_at still succeed.
  alter table public.stock_consumptions
    alter column occurred_at set default now();
end $$;

