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

  const newOrder = await base.eq("status", "new_order");
  const newMissing =
    Boolean((newOrder.error as any)?.code === "22P02") ||
    (typeof (newOrder.error as any)?.message === "string" &&
      String((newOrder.error as any)?.message).toLowerCase().includes("order_status"));
  if (newOrder.error && !newMissing) throw newOrder.error;

  const ready = await base.eq("status", "ready_for_pickup");
  const readyMissing =
    Boolean((ready.error as any)?.code === "22P02") ||
    (typeof (ready.error as any)?.message === "string" &&
      String((ready.error as any)?.message).toLowerCase().includes("order_status"));
  if (ready.error && !readyMissing) throw ready.error;

  const backorder = await base.eq("status", "backorder");
  const backorderMissing =
    Boolean((backorder.error as any)?.code === "22P02") ||
    (typeof (backorder.error as any)?.message === "string" &&
      String((backorder.error as any)?.message).toLowerCase().includes("order_status"));
  if (backorder.error && !backorderMissing) throw backorder.error;

  const completed = await base.eq("status", "completed");
  const completedMissing =
    Boolean((completed.error as any)?.code === "22P02") ||
    (typeof (completed.error as any)?.message === "string" &&
      String((completed.error as any)?.message).toLowerCase().includes("order_status"));
  if (completed.error && !completedMissing) throw completed.error;

  const data = [
    ...(paid.data ?? []),
    ...(!fulfilled.error && !fulfilledMissing ? (fulfilled.data ?? []) : []),
    ...(!newOrder.error && !newMissing ? (newOrder.data ?? []) : []),
    ...(!ready.error && !readyMissing ? (ready.data ?? []) : []),
    ...(!backorder.error && !backorderMissing ? (backorder.data ?? []) : []),
    ...(!completed.error && !completedMissing ? (completed.data ?? []) : [])
  ];

  const rows = data ?? [];
  const revenueCents = rows.reduce((s: number, r: { total_cents: number | null }) => s + (r.total_cents ?? 0), 0);
  return { orderCount: rows.length, revenueCents };
}
