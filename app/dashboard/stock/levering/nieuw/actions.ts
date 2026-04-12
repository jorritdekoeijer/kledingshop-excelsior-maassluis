"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createStockDeliverySchema } from "@/lib/validation/stock-delivery";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function createStockDeliveryAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock/levering/nieuw?error=Geen%20toegang");

  const parsed = createStockDeliverySchema.safeParse(input);
  if (!parsed.success) {
    redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  const { data: delivery, error: de } = await service
    .from("stock_deliveries")
    .insert({
      invoice_date: d.invoiceDate?.trim() ? d.invoiceDate.trim() : null,
      supplier: d.supplier?.trim() || null,
      invoice_number: d.invoiceNumber?.trim() || null
    })
    .select("id")
    .single();

  if (de || !delivery) {
    redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent(de?.message ?? "Levering opslaan mislukt")}`);
  }

  const receivedAtIso = d.invoiceDate?.trim()
    ? new Date(`${d.invoiceDate.trim()}T12:00:00`).toISOString()
    : new Date().toISOString();

  const note = d.invoiceNumber?.trim()
    ? `Levering ${d.invoiceNumber.trim()}${d.supplier?.trim() ? ` — ${d.supplier.trim()}` : ""}`
    : null;

  const batchRows = d.lines.map((line) => ({
    product_id: line.productId,
    stock_delivery_id: delivery.id,
    received_at: receivedAtIso,
    quantity_received: line.quantity,
    quantity_remaining: line.quantity,
    size_label: line.sizeLabel.trim(),
    unit_purchase_excl_cents: line.unitPurchaseExclCents,
    note
  }));

  const { error: be } = await service.from("stock_batches").insert(batchRows);
  if (be) {
    await service.from("stock_deliveries").delete().eq("id", delivery.id);
    redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent(be.message)}`);
  }

  redirect("/dashboard/stock?ok=1");
}
