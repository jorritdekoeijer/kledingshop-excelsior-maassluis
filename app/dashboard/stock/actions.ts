"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { consumeStockSchema } from "@/lib/validation/stock";

export async function consumeStock(formData: FormData) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const vmRaw = String(formData.get("variantMode") ?? "").trim();

  const parsed = consumeStockSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    reason: String(formData.get("reason") ?? "sale"),
    variantMode: vmRaw === "" ? undefined : vmRaw,
    sizeLabel: formData.get("sizeLabel")
  });
  if (!parsed.success) redirect("/dashboard/stock?error=Invalid");

  const { productId, quantity, reason, variantMode: mode, sizeLabel } = parsed.data;

  const pVariant = mode === "legacy" || mode === undefined ? null : mode;
  const pSize =
    mode === "legacy" || mode === undefined
      ? null
      : sizeLabel != null && String(sizeLabel).trim() !== ""
        ? String(sizeLabel).trim()
        : null;

  const service = createSupabaseServiceClient();
  const { error } = await service.rpc("consume_stock_fifo", {
    p_product_id: productId,
    p_quantity: quantity,
    p_reason: reason,
    p_variant: pVariant,
    p_size: pSize
  });
  if (error) redirect(`/dashboard/stock?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard/stock?ok=1");
}
