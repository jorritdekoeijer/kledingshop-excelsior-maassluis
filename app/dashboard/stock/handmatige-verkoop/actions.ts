"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createManualSaleSchema } from "@/lib/validation/manual-sale";

export async function createManualSaleAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const parsed = createManualSaleSchema.safeParse(input);
  if (!parsed.success) {
    redirect(`/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  // Use a fixed midday timestamp to avoid TZ edge cases around midnight.
  const occurredAt = `${d.saleDate}T12:00:00.000Z`;
  const reason = "manual_sale";

  for (const li of d.lines) {
    const { error } = await service.rpc("consume_stock_fifo_at", {
      p_product_id: li.productId,
      p_quantity: li.quantity,
      p_reason: reason,
      p_variant: li.variantSegment,
      p_size: li.sizeLabel,
      p_occurred_at: occurredAt
    });
    if (error) {
      redirect(
        `/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(
          `${error.message} (product=${li.productId} · variant=${li.variantSegment} · maat=${li.sizeLabel})`
        )}`
      );
    }
  }

  redirect("/dashboard/stock?ok=1");
}

