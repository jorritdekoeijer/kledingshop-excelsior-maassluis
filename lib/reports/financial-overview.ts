import type { SupabaseClient } from "@supabase/supabase-js";
import { exclCentsFromIncl21 } from "@/lib/money/nl-euro";
import { normalizeVariantBlock } from "@/lib/shop/product-json";

export type FinancialPeriod = {
  fromDate: string;
  toDate: string;
  startIso: string;
  endIso: string;
};

export type CostGroupSpend = {
  id: string;
  name: string;
  totalPurchaseExclCents: number;
};

export type WebshopFinancials = {
  orderCount: number;
  revenueInclCents: number;
  revenueExclCents: number;
  cogsExclCents: number;
  grossMarginExclCents: number;
  marginPercent: number | null;
};

export type InventoryValuation = {
  valueExclCents: number;
  linesWithStock: number;
  batchesMissingPurchasePrice: number;
};

export type FinancialOverviewReport = {
  period: FinancialPeriod;
  costGroups: CostGroupSpend[];
  internalOrdersTotalExclCents: number;
  internalOrdersExcludedGroupNames: string[];
  webshop: WebshopFinancials;
  inventory: InventoryValuation;
  warnings: string[];
};

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

/** Parse YYYY-MM-DD; valt terug op huidig voetbalseizoen (01-07 t/m 30-06). */
export function resolveReportPeriod(fromRaw: string | undefined, toRaw: string | undefined): FinancialPeriod {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = today.getFullYear();
  const m = today.getMonth() + 1; // 1-12
  const seasonStartYear = m >= 7 ? y : y - 1;
  const seasonEndYear = seasonStartYear + 1;
  const defaultFrom = `${seasonStartYear}-07-01`;
  const defaultTo = `${seasonEndYear}-06-30`;

  const fromDate = fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : defaultFrom;
  const toDate = toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : defaultTo;

  let from = fromDate;
  let to = toDate;
  if (from > to) {
    const t = from;
    from = to;
    to = t;
  }

  const startIso = `${from}T00:00:00.000Z`;
  const endIso = `${to}T23:59:59.999Z`;

  return { fromDate: from, toDate: to, startIso, endIso };
}

export async function fetchFinancialOverview(
  supabase: SupabaseClient,
  period: FinancialPeriod
): Promise<FinancialOverviewReport> {
  const { startIso, endIso, fromDate, toDate } = period;

  const warnings: string[] = [];

  const asErr = (label: string, e: unknown) => {
    if (e && typeof e === "object" && "message" in e) {
      const anyE = e as any;
      const extra = [
        anyE.code ? `code=${String(anyE.code)}` : null,
        anyE.details ? `details=${String(anyE.details)}` : null,
        anyE.hint ? `hint=${String(anyE.hint)}` : null
      ]
        .filter(Boolean)
        .join(" · ");
      return new Error(extra ? `${label}: ${anyE.message} (${extra})` : `${label}: ${anyE.message}`);
    }
    return new Error(`${label}: ${String(e)}`);
  };

  const [cgRes, ioRes, paidRes, fulfilledRes, newRes, readyRes, backorderRes, completedRes, batchRes] = await Promise.all([
    supabase.from("cost_groups").select("id,name").order("name"),
    supabase
      .from("internal_orders")
      .select("cost_group_id,total_purchase_excl_cents,order_date")
      .gte("order_date", fromDate)
      .lte("order_date", toDate),
    supabase
      .from("orders")
      .select("id,total_cents,status,created_at")
      .eq("status", "paid")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    // Sommige databases hebben geen 'fulfilled' enum value. Probeer apart; bij 22P02 negeren.
    supabase
      .from("orders")
      .select("id,total_cents,status,created_at")
      .eq("status", "fulfilled")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    // Nieuwere workflow-statussen (na betaling). Op oudere schema's kunnen deze enum values ontbreken.
    supabase
      .from("orders")
      .select("id,total_cents,status,created_at")
      .eq("status", "new_order")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("orders")
      .select("id,total_cents,status,created_at")
      .eq("status", "ready_for_pickup")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("orders")
      .select("id,total_cents,status,created_at")
      .eq("status", "backorder")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("orders")
      .select("id,total_cents,status,created_at")
      .eq("status", "completed")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("stock_batches")
      .select("id,quantity_remaining,unit_purchase_excl_cents,unit_printing_excl_cents")
      .gt("quantity_remaining", 0)
  ]);

  if (cgRes.error) throw asErr("cost_groups select", cgRes.error);
  // `internal_orders` bestaat pas na migratie 0017. Als die nog niet gedraaid is, behandel als 0 (rapportage blijft bruikbaar).
  const internalOrdersMissing =
    Boolean((ioRes.error as any)?.code === "PGRST205") ||
    (typeof (ioRes.error as any)?.message === "string" &&
      String((ioRes.error as any)?.message).toLowerCase().includes("internal_orders"));
  if (ioRes.error && !internalOrdersMissing) throw asErr("internal_orders select", ioRes.error);
  if (paidRes.error) throw asErr("orders select (paid)", paidRes.error);
  const fulfilledMissing =
    Boolean((fulfilledRes.error as any)?.code === "22P02") ||
    (typeof (fulfilledRes.error as any)?.message === "string" &&
      String((fulfilledRes.error as any)?.message).toLowerCase().includes("order_status"));
  if (fulfilledRes.error && !fulfilledMissing) throw asErr("orders select (fulfilled)", fulfilledRes.error);
  const newMissing =
    Boolean((newRes.error as any)?.code === "22P02") ||
    (typeof (newRes.error as any)?.message === "string" && String((newRes.error as any)?.message).toLowerCase().includes("order_status"));
  if (newRes.error && !newMissing) throw asErr("orders select (new_order)", newRes.error);
  const readyMissing =
    Boolean((readyRes.error as any)?.code === "22P02") ||
    (typeof (readyRes.error as any)?.message === "string" && String((readyRes.error as any)?.message).toLowerCase().includes("order_status"));
  if (readyRes.error && !readyMissing) throw asErr("orders select (ready_for_pickup)", readyRes.error);
  const backorderMissing =
    Boolean((backorderRes.error as any)?.code === "22P02") ||
    (typeof (backorderRes.error as any)?.message === "string" && String((backorderRes.error as any)?.message).toLowerCase().includes("order_status"));
  if (backorderRes.error && !backorderMissing) throw asErr("orders select (backorder)", backorderRes.error);
  const completedMissing =
    Boolean((completedRes.error as any)?.code === "22P02") ||
    (typeof (completedRes.error as any)?.message === "string" && String((completedRes.error as any)?.message).toLowerCase().includes("order_status"));
  if (completedRes.error && !completedMissing) throw asErr("orders select (completed)", completedRes.error);
  if (batchRes.error) throw asErr("stock_batches select", batchRes.error);

  // COGS (inkoop van verkochte voorraad) via stock_consumptions + batch.unit_purchase_excl_cents.
  // Oudere schema's missen `stock_consumptions.reason`; dan kunnen we niet filteren.
  // Nieuw: handmatige verkopen tellen mee als COGS (reason = manual_sale).
  let consRes: any = await supabase
    .from("stock_consumptions")
    .select("quantity,reason,occurred_at,created_at,stock_batches(unit_purchase_excl_cents,unit_printing_excl_cents)")
    .in("reason", ["sale", "manual_sale"])
    .gte("occurred_at", startIso)
    .lte("occurred_at", endIso);

  const reasonMissing =
    Boolean((consRes.error as any)?.code === "42703") &&
    String((consRes.error as any)?.message ?? "").toLowerCase().includes("reason");
  const occurredMissing =
    Boolean((consRes.error as any)?.code === "42703") &&
    String((consRes.error as any)?.message ?? "").toLowerCase().includes("occurred_at");

  if (occurredMissing) {
    consRes = await supabase
      .from("stock_consumptions")
      .select("quantity,reason,created_at,stock_batches(unit_purchase_excl_cents,unit_printing_excl_cents)")
      .in("reason", ["sale", "manual_sale"])
      .gte("created_at", startIso)
      .lte("created_at", endIso);
  }
  if (consRes.error && !reasonMissing) throw asErr("stock_consumptions select", consRes.error);
  if (reasonMissing) {
    warnings.push(
      "Inkoop verkopen (FIFO) kon niet worden berekend: kolom stock_consumptions.reason ontbreekt in je database. Draai migratie 0003_product_images_and_fifo.sql (of voeg de kolom toe) om dit te activeren."
    );
  }

  const groups = (cgRes.data ?? []) as { id: string; name: string }[];
  const spendByGroup = new Map<string, number>();
  if (!internalOrdersMissing) {
    for (const row of ioRes.data ?? []) {
      const id = (row as { cost_group_id: string }).cost_group_id;
      const t = Number((row as { total_purchase_excl_cents: number }).total_purchase_excl_cents ?? 0);
      spendByGroup.set(id, (spendByGroup.get(id) ?? 0) + t);
    }
  }
  const costGroups: CostGroupSpend[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    totalPurchaseExclCents: spendByGroup.get(g.id) ?? 0
  }));

  const excludedNames = new Set(["BOEKINGSVERSCHILLEN"]);
  const internalOrdersExcludedGroupNames = costGroups
    .map((c) => c.name)
    .filter((n) => excludedNames.has(String(n ?? "").trim().toUpperCase()));

  const internalOrdersTotalExclCents = sum(
    costGroups
      .filter((c) => !excludedNames.has(String(c.name ?? "").trim().toUpperCase()))
      .map((c) => c.totalPurchaseExclCents)
  );

  const orderRows = [
    ...(paidRes.data ?? []),
    ...((fulfilledRes.error || fulfilledMissing) ? [] : (fulfilledRes.data ?? [])),
    ...((newRes.error || newMissing) ? [] : (newRes.data ?? [])),
    ...((readyRes.error || readyMissing) ? [] : (readyRes.data ?? [])),
    ...((backorderRes.error || backorderMissing) ? [] : (backorderRes.data ?? [])),
    ...((completedRes.error || completedMissing) ? [] : (completedRes.data ?? []))
  ] as { total_cents: number | null }[];
  const orderCount = orderRows.length;
  const revenueInclCents = sum(orderRows.map((o) => Number(o.total_cents ?? 0)));
  const revenueExclCents = sum(orderRows.map((o) => exclCentsFromIncl21(Number(o.total_cents ?? 0))));

  // Extra omzet: handmatige verkopen (interne verkooporders) → aantal × verkoopprijs (productvariant sale_cents).
  let manualRevenueInclCents = 0;
  const manualConsRes: any = await supabase
    .from("stock_consumptions")
    .select("quantity,reason,occurred_at,created_at,stock_batches(product_id,variant_segment)")
    .eq("reason", "manual_sale")
    .gte("occurred_at", startIso)
    .lte("occurred_at", endIso);

  const manualOccurredMissing =
    Boolean((manualConsRes.error as any)?.code === "42703") &&
    String((manualConsRes.error as any)?.message ?? "").toLowerCase().includes("occurred_at");
  if (manualOccurredMissing) {
    const retry: any = await supabase
      .from("stock_consumptions")
      .select("quantity,reason,created_at,stock_batches(product_id,variant_segment)")
      .eq("reason", "manual_sale")
      .gte("created_at", startIso)
      .lte("created_at", endIso);
    (manualConsRes as any).data = retry.data;
    (manualConsRes as any).error = retry.error;
  }

  if (manualConsRes.error) {
    warnings.push(
      `Handmatige verkoop-omzet kon niet worden berekend: ${(manualConsRes.error as any)?.message ?? "Onbekende fout"}`
    );
  } else {
    const rows = (manualConsRes.data ?? []) as any[];
    const productIds = Array.from(
      new Set(rows.map((r) => String((r as any)?.stock_batches?.product_id ?? "")).filter(Boolean))
    );

    const productMap = new Map<string, any>();
    if (productIds.length > 0) {
      const pr = await supabase
        .from("products")
        .select("id,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize")
        .in("id", productIds);
      if (pr.error) {
        warnings.push(`Handmatige verkoop-omzet kon producten niet laden: ${pr.error.message}`);
      } else {
        for (const p of pr.data ?? []) productMap.set(String((p as any).id), p);
      }
    }

    const saleCentsFor = (p: any, variant: string | null | undefined): number | null => {
      const v = String(variant ?? "").trim();
      const block =
        v === "youth"
          ? normalizeVariantBlock(p?.variant_youth)
          : v === "adult"
            ? normalizeVariantBlock(p?.variant_adult)
            : v === "socks"
              ? normalizeVariantBlock(p?.variant_socks)
              : v === "shoes"
                ? normalizeVariantBlock(p?.variant_shoes)
                : v === "onesize"
                  ? normalizeVariantBlock(p?.variant_onesize)
                  : null;
      const sc = block ? block.sale_cents : null;
      return typeof sc === "number" && Number.isFinite(sc) && sc >= 0 ? sc : null;
    };

    let missingPrice = 0;
    for (const r of rows) {
      const qty = Number((r as any).quantity ?? 0);
      const b = (r as any).stock_batches;
      const batch = Array.isArray(b) ? b[0] : b;
      const productId = String(batch?.product_id ?? "");
      const variant = batch?.variant_segment != null ? String(batch.variant_segment) : "";
      if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
      const p = productMap.get(productId);
      const sale = p ? saleCentsFor(p, variant) : null;
      if (sale == null) {
        missingPrice += 1;
        continue;
      }
      manualRevenueInclCents += qty * sale;
    }
    if (missingPrice > 0) {
      warnings.push(
        `Handmatige verkoop-omzet: ${missingPrice} regel(s) konden niet worden gewaardeerd omdat verkoopprijs ontbreekt op het product.`
      );
    }
  }

  const totalRevenueInclCents = revenueInclCents + manualRevenueInclCents;
  const totalRevenueExclCents = revenueExclCents + exclCentsFromIncl21(manualRevenueInclCents);

  let cogsExclCents = 0;
  if (!reasonMissing) {
    for (const row of consRes.data ?? []) {
      const r = row as {
        quantity: number;
        stock_batches:
          | { unit_purchase_excl_cents: number | null; unit_printing_excl_cents?: number | null }
          | { unit_purchase_excl_cents: number | null; unit_printing_excl_cents?: number | null }[]
          | null;
      };
      const qty = Number(r.quantity ?? 0);
      const b = r.stock_batches;
      const batch = Array.isArray(b) ? b[0] : b;
      const baseUnit = batch?.unit_purchase_excl_cents;
      const printUnit = batch?.unit_printing_excl_cents ?? 0;
      if (baseUnit != null && Number.isFinite(baseUnit) && baseUnit >= 0) {
        const unitTotal = baseUnit + (Number.isFinite(printUnit) && printUnit >= 0 ? printUnit : 0);
        cogsExclCents += qty * unitTotal;
      }
    }
  }

  // Extra COGS: rugnummer (interne kostprijs) op order_items.
  // Dit is geen voorraad-batch, dus zit niet in stock_consumptions.
  const oiRes = await supabase
    .from("order_items")
    .select("quantity,jersey_number_purchase_excl_cents,orders(status,created_at)")
    .not("jersey_number_purchase_excl_cents", "is", null)
    .gte("orders.created_at", startIso)
    .lte("orders.created_at", endIso);
  if (oiRes.error) {
    warnings.push(`Rugnummer-kostprijs kon niet worden meegenomen: ${oiRes.error.message}`);
  } else {
    for (const row of oiRes.data ?? []) {
      const r = row as any;
      const qty = Number(r.quantity ?? 0);
      const unit = Number(r.jersey_number_purchase_excl_cents ?? 0);
      if (Number.isFinite(qty) && qty > 0 && Number.isFinite(unit) && unit > 0) {
        cogsExclCents += qty * unit;
      }
    }
  }

  const grossMarginExclCents = totalRevenueExclCents - cogsExclCents;
  const marginPercent =
    totalRevenueExclCents > 0 ? Math.round((grossMarginExclCents / totalRevenueExclCents) * 1000) / 10 : null;

  let valueExclCents = 0;
  let batchesMissingPurchasePrice = 0;
  let linesWithStock = 0;
  for (const b of batchRes.data ?? []) {
    const row = b as { quantity_remaining: number; unit_purchase_excl_cents: number | null; unit_printing_excl_cents?: number | null };
    const q = Number(row.quantity_remaining ?? 0);
    if (q <= 0) continue;
    linesWithStock += 1;
    const baseUnit = row.unit_purchase_excl_cents;
    const printUnit = row.unit_printing_excl_cents ?? 0;
    if (baseUnit != null && Number.isFinite(baseUnit) && baseUnit >= 0) {
      const unitTotal = baseUnit + (Number.isFinite(printUnit) && printUnit >= 0 ? printUnit : 0);
      valueExclCents += q * unitTotal;
    } else {
      batchesMissingPurchasePrice += 1;
    }
  }

  return {
    period: { fromDate, toDate, startIso, endIso },
    costGroups,
    internalOrdersTotalExclCents,
    internalOrdersExcludedGroupNames,
    webshop: {
      orderCount,
      revenueInclCents: totalRevenueInclCents,
      revenueExclCents: totalRevenueExclCents,
      cogsExclCents,
      grossMarginExclCents,
      marginPercent
    },
    inventory: {
      valueExclCents,
      linesWithStock,
      batchesMissingPurchasePrice
    },
    warnings
  };
}
