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

  const paid = await base.eq("status", "paid");
  if (paid.error) throw paid.error;

  const fulfilled = await base.eq("status", "fulfilled");
  const fulfilledMissing =
    Boolean((fulfilled.error as any)?.code === "22P02") ||
    (typeof (fulfilled.error as any)?.message === "string" &&
      String((fulfilled.error as any)?.message).toLowerCase().includes("order_status"));
  if (fulfilled.error && !fulfilledMissing) throw fulfilled.error;

  const data = [...(paid.data ?? []), ...(!fulfilled.error && !fulfilledMissing ? (fulfilled.data ?? []) : [])];

  const rows = data ?? [];
  const revenueCents = rows.reduce((s: number, r: { total_cents: number | null }) => s + (r.total_cents ?? 0), 0);
  return { orderCount: rows.length, revenueCents };
}
