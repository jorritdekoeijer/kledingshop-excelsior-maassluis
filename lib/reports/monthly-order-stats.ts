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
  const { data, error } = await svc
    .from("orders")
    .select("total_cents")
    .in("status", ["paid", "fulfilled"])
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) throw error;
  const rows = data ?? [];
  const revenueCents = rows.reduce((s, r) => s + (r.total_cents ?? 0), 0);
  return { orderCount: rows.length, revenueCents };
}
