import type { SupabaseClient } from "@supabase/supabase-js";

export type MonthlyOrderStats = {
  orderCount: number;
  revenueCents: number;
};

/** Orders met status betaald/afgehandeld, aangemaakt in de periode [start, end). */
export async function fetchMonthlyOrderStats(
  svc: SupabaseClient,
  startIso: string,
  endIso: string
): Promise<MonthlyOrderStats> {
  const base = svc
    .from("orders")
    .select("total_cents")
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  let data: { total_cents: number | null }[] | null = null;
  let error: unknown = null;

  const first = await base.in("status", ["paid", "fulfilled"]);
  if (!first.error) {
    data = first.data as { total_cents: number | null }[] | null;
    error = null;
  } else {
    const msg = String((first.error as any)?.message ?? "");
    const code = String((first.error as any)?.code ?? "");
    if (code === "22P02" && msg.includes("order_status") && msg.includes("fulfilled")) {
      const second = await base.in("status", ["paid"]);
      data = second.data as { total_cents: number | null }[] | null;
      error = second.error;
    } else {
      data = first.data as { total_cents: number | null }[] | null;
      error = first.error;
    }
  }

  if (error) throw error;
  const rows = data ?? [];
  const revenueCents = rows.reduce((s: number, r: { total_cents: number | null }) => s + (r.total_cents ?? 0), 0);
  return { orderCount: rows.length, revenueCents };
}
