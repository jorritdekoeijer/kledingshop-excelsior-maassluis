import { createSupabaseServiceClient } from "@/lib/supabase/service";

type Svc = ReturnType<typeof createSupabaseServiceClient>;

/** Som van quantity_remaining voor batches die bij deze winkelregel horen (product + YOUTH/ADULT + maat). */
export async function sumAvailableStockForLine(
  svc: Svc,
  productId: string,
  variant: "youth" | "adult" | "socks" | "shoes" | "onesize" | null | undefined,
  size: string | null | undefined
): Promise<number> {
  let q = svc.from("stock_batches").select("quantity_remaining").eq("product_id", productId);

  if (variant) {
    q = q.eq("variant_segment", variant);
  } else {
    q = q.is("variant_segment", null);
  }

  const sz = size?.trim() ?? "";
  if (sz) {
    q = q.eq("size_label", sz);
  } else {
    q = q.is("size_label", null);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).reduce((s, r: { quantity_remaining: number | null }) => s + (r.quantity_remaining ?? 0), 0);
}
