import type { SupabaseClient } from "@supabase/supabase-js";
import { exclCentsFromIncl21 } from "@/lib/money/nl-euro";

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
  webshop: WebshopFinancials;
  inventory: InventoryValuation;
};

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

/** Parse YYYY-MM-DD; valt terug op begin dit jaar / vandaag. */
export function resolveReportPeriod(fromRaw: string | undefined, toRaw: string | undefined): FinancialPeriod {
  const today = new Date();
  const y = today.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultFrom = `${y}-01-01`;
  const defaultTo = `${y}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

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

  const [cgRes, ioRes, ordRes, consRes, batchRes] = await Promise.all([
    supabase.from("cost_groups").select("id,name").order("name"),
    supabase
      .from("internal_orders")
      .select("cost_group_id,total_purchase_excl_cents,order_date")
      .gte("order_date", fromDate)
      .lte("order_date", toDate),
    // Sommige databases hebben nog geen 'fulfilled' in de enum order_status. We proberen eerst paid+fulfilled,
    // en vallen terug op alleen paid bij enum-fout (22P02).
    (async () => {
      const base = supabase
        .from("orders")
        .select("id,total_cents,status,created_at")
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      const a = await base.in("status", ["paid", "fulfilled"]);
      if (!a.error) return a;
      const msg = String((a.error as any)?.message ?? "");
      const code = String((a.error as any)?.code ?? "");
      if (code === "22P02" && msg.includes("order_status") && msg.includes("fulfilled")) {
        return await base.in("status", ["paid"]);
      }
      return a;
    })(),
    supabase
      .from("stock_consumptions")
      .select("quantity,reason,created_at,stock_batches(unit_purchase_excl_cents)")
      .eq("reason", "sale")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("stock_batches")
      .select("id,quantity_remaining,unit_purchase_excl_cents")
      .gt("quantity_remaining", 0)
  ]);

  if (cgRes.error) throw asErr("cost_groups select", cgRes.error);
  // `internal_orders` bestaat pas na migratie 0017. Als die nog niet gedraaid is, behandel als 0 (rapportage blijft bruikbaar).
  const internalOrdersMissing =
    Boolean((ioRes.error as any)?.code === "PGRST205") ||
    (typeof (ioRes.error as any)?.message === "string" &&
      String((ioRes.error as any)?.message).toLowerCase().includes("internal_orders"));
  if (ioRes.error && !internalOrdersMissing) throw asErr("internal_orders select", ioRes.error);
  if (ordRes.error) throw asErr("orders select", ordRes.error);
  if (consRes.error) throw asErr("stock_consumptions select", consRes.error);
  if (batchRes.error) throw asErr("stock_batches select", batchRes.error);

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
  const internalOrdersTotalExclCents = sum(costGroups.map((c) => c.totalPurchaseExclCents));

  const orderRows = (ordRes.data ?? []) as { total_cents: number | null }[];
  const orderCount = orderRows.length;
  const revenueInclCents = sum(orderRows.map((o) => Number(o.total_cents ?? 0)));
  const revenueExclCents = sum(orderRows.map((o) => exclCentsFromIncl21(Number(o.total_cents ?? 0))));

  let cogsExclCents = 0;
  for (const row of consRes.data ?? []) {
    const r = row as {
      quantity: number;
      stock_batches: { unit_purchase_excl_cents: number | null } | { unit_purchase_excl_cents: number | null }[] | null;
    };
    const qty = Number(r.quantity ?? 0);
    const b = r.stock_batches;
    const batch = Array.isArray(b) ? b[0] : b;
    const unit = batch?.unit_purchase_excl_cents;
    if (unit != null && Number.isFinite(unit) && unit >= 0) {
      cogsExclCents += qty * unit;
    }
  }

  const grossMarginExclCents = revenueExclCents - cogsExclCents;
  const marginPercent =
    revenueExclCents > 0 ? Math.round((grossMarginExclCents / revenueExclCents) * 1000) / 10 : null;

  let valueExclCents = 0;
  let batchesMissingPurchasePrice = 0;
  let linesWithStock = 0;
  for (const b of batchRes.data ?? []) {
    const row = b as { quantity_remaining: number; unit_purchase_excl_cents: number | null };
    const q = Number(row.quantity_remaining ?? 0);
    if (q <= 0) continue;
    linesWithStock += 1;
    const unit = row.unit_purchase_excl_cents;
    if (unit != null && Number.isFinite(unit) && unit >= 0) {
      valueExclCents += q * unit;
    } else {
      batchesMissingPurchasePrice += 1;
    }
  }

  return {
    period: { fromDate, toDate, startIso, endIso },
    costGroups,
    internalOrdersTotalExclCents,
    webshop: {
      orderCount,
      revenueInclCents,
      revenueExclCents,
      cogsExclCents,
      grossMarginExclCents,
      marginPercent
    },
    inventory: {
      valueExclCents,
      linesWithStock,
      batchesMissingPurchasePrice
    }
  };
}
