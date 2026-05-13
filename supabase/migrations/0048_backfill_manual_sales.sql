-- Backfill: zet bestaande handmatige verkopen die alleen als stock_consumptions
-- (reason='manual_sale') bestaan om naar nette manual_sales + manual_sale_lines records.
--
-- Achtergrond:
-- Vóór migratie 0045_manual_sales_tables.sql schreef de handmatige-verkoop-action alleen
-- stock_consumptions weg met reason='manual_sale'. Die data telt op de rapportage wel mee
-- (via een legacy fallback) maar verschijnt niet in het overzicht op de handmatige
-- verkoop-pagina. Deze migratie reconstrueert "verkopen" door consumpties per dag te
-- groeperen en per (product, variant, maat) één regel te maken met de actuele verkoopprijs
-- als unit_revenue_incl_cents.
--
-- Idempotent: alleen consumpties zonder manual_sale_line_id worden meegenomen.

do $$
declare
  d date;
  v_sale_id uuid;
  v_line_id uuid;
  v_unit_rev int;
  rec record;
begin
  -- Vereist: manual_sales tabel moet bestaan (migratie 0045).
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'manual_sales'
  ) then
    raise notice 'Skip backfill: public.manual_sales bestaat nog niet (draai eerst migratie 0045_manual_sales_tables.sql).';
    return;
  end if;

  -- Vereist: manual_sale_line_id kolom moet bestaan.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_consumptions'
      and column_name = 'manual_sale_line_id'
  ) then
    raise notice 'Skip backfill: stock_consumptions.manual_sale_line_id bestaat nog niet (draai eerst migratie 0045_manual_sales_tables.sql).';
    return;
  end if;

  for d in
    select distinct coalesce(
      (occurred_at at time zone 'UTC')::date,
      (created_at  at time zone 'UTC')::date
    ) as sd
    from public.stock_consumptions
    where reason = 'manual_sale'
      and manual_sale_line_id is null
    order by sd
  loop
    -- Header per datum
    insert into public.manual_sales (sale_date, note)
    values (d, 'Achteraf overgezet (legacy backfill)')
    returning id into v_sale_id;

    -- Per unieke (product, variant, maat) op die datum: één regel met het totaal aantal
    for rec in
      select
        sb.product_id,
        sb.variant_segment,
        sb.size_label,
        sum(sc.quantity)::int as total_qty,
        p.variant_youth,
        p.variant_adult,
        p.variant_socks,
        p.variant_shoes,
        p.variant_onesize
      from public.stock_consumptions sc
      join public.stock_batches sb on sb.id = sc.stock_batch_id
      left join public.products p on p.id = sb.product_id
      where sc.reason = 'manual_sale'
        and sc.manual_sale_line_id is null
        and coalesce(
          (sc.occurred_at at time zone 'UTC')::date,
          (sc.created_at  at time zone 'UTC')::date
        ) = d
      group by sb.product_id, sb.variant_segment, sb.size_label,
               p.variant_youth, p.variant_adult, p.variant_socks, p.variant_shoes, p.variant_onesize
    loop
      v_unit_rev := 0;
      if rec.variant_segment = 'youth' then
        v_unit_rev := coalesce(nullif(rec.variant_youth->>'sale_cents', '')::int, 0);
      elsif rec.variant_segment = 'adult' then
        v_unit_rev := coalesce(nullif(rec.variant_adult->>'sale_cents', '')::int, 0);
      elsif rec.variant_segment = 'socks' then
        v_unit_rev := coalesce(nullif(rec.variant_socks->>'sale_cents', '')::int, 0);
      elsif rec.variant_segment = 'shoes' then
        v_unit_rev := coalesce(nullif(rec.variant_shoes->>'sale_cents', '')::int, 0);
      elsif rec.variant_segment = 'onesize' then
        v_unit_rev := coalesce(nullif(rec.variant_onesize->>'sale_cents', '')::int, 0);
      end if;

      insert into public.manual_sale_lines (
        manual_sale_id, product_id, is_set, quantity,
        unit_revenue_incl_cents, variant_segment, size_label
      )
      values (
        v_sale_id, rec.product_id, false, rec.total_qty,
        v_unit_rev, rec.variant_segment, rec.size_label
      )
      returning id into v_line_id;

      -- Koppel de bron-consumpties aan deze regel zodat ze niet opnieuw worden meegenomen
      -- en zodat de rapportage ze niet meer als legacy fallback dubbeltelt.
      update public.stock_consumptions sc
      set manual_sale_line_id = v_line_id
      from public.stock_batches sb
      where sc.stock_batch_id = sb.id
        and sc.reason = 'manual_sale'
        and sc.manual_sale_line_id is null
        and coalesce(
          (sc.occurred_at at time zone 'UTC')::date,
          (sc.created_at  at time zone 'UTC')::date
        ) = d
        and sb.product_id is not distinct from rec.product_id
        and sb.variant_segment is not distinct from rec.variant_segment
        and sb.size_label is not distinct from rec.size_label;
    end loop;
  end loop;
end $$;
