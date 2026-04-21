"use server";

import { redirect } from "next/navigation";
import { createStockDeliverySchema } from "@/lib/validation/stock-delivery";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";

export async function updateStockDeliveryAction(deliveryId: string, input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=Geen%20toegang`);

  const parsed = createStockDeliverySchema.safeParse(input);
  if (!parsed.success) {
    redirect(
      `/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`
    );
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  // Ophalen huidige batches; alleen bewerken als niets verbruikt is.
  const { data: batches, error: bErr } = await service
    .from("stock_batches")
    .select("id,quantity_received,quantity_remaining")
    .eq("stock_delivery_id", deliveryId);
  if (bErr) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(bErr))}`);

  const batchIds = (batches ?? []).map((b: any) => b.id).filter(Boolean);
  const anyConsumed = (batches ?? []).some((b: any) => Number(b.quantity_remaining ?? 0) < Number(b.quantity_received ?? 0));
  if (anyConsumed) {
    redirect(
      `/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(
        "Deze levering kan niet meer worden bewerkt omdat er al voorraad uit is verbruikt. Maak in plaats daarvan een correctielevering."
      )}`
    );
  }

  if (batchIds.length > 0) {
    const cons = await service
      .from("stock_consumptions")
      .select("*", { count: "exact", head: true })
      .in("stock_batch_id", batchIds);
    if (cons.error) {
      redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(cons.error))}`);
    }
    if ((cons.count ?? 0) > 0) {
      redirect(
        `/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(
          "Deze levering kan niet meer worden bewerkt omdat er al voorraadmutaties aan gekoppeld zijn. Maak een correctielevering."
        )}`
      );
    }
  }

  // Update factuurkop.
  const { error: upErr } = await service
    .from("stock_deliveries")
    .update({
      invoice_date: d.invoiceDate?.trim() ? d.invoiceDate.trim() : null,
      supplier: d.supplier?.trim() || null,
      invoice_number: d.invoiceNumber?.trim() || null,
      invoice_total_incl_cents: d.invoiceTotalInclCents ?? null
    })
    .eq("id", deliveryId);
  if (upErr) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(upErr))}`);

  const receivedAtIso = d.invoiceDate?.trim()
    ? new Date(`${d.invoiceDate.trim()}T12:00:00`).toISOString()
    : new Date().toISOString();
  const note = d.invoiceNumber?.trim()
    ? `Levering ${d.invoiceNumber.trim()}${d.supplier?.trim() ? ` — ${d.supplier.trim()}` : ""}`
    : null;

  // Vervang batches voor deze levering (veilig omdat er geen consumptions zijn).
  const del = await service.from("stock_batches").delete().eq("stock_delivery_id", deliveryId);
  if (del.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(del.error))}`);

  const batchRows = d.lines.map((line) => ({
    product_id: line.productId,
    stock_delivery_id: deliveryId,
    received_at: receivedAtIso,
    quantity_received: line.quantity,
    quantity_remaining: line.quantity,
    variant_segment: line.variantSegment,
    size_label: line.sizeLabel.trim(),
    unit_purchase_excl_cents: line.unitPurchaseExclCents,
    unit_printing_excl_cents: line.unitPrintingExclCents,
    note
  }));

  const ins = await service.from("stock_batches").insert(batchRows);
  if (ins.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(ins.error))}`);

  redirect(`/dashboard/stock/levering/${deliveryId}/edit?ok=1`);
}

