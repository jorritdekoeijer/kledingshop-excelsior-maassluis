"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createStockDeliverySchema } from "@/lib/validation/stock-delivery";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";

export async function createStockDeliveryAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock/levering/nieuw?error=Geen%20toegang");

  const parsed = createStockDeliverySchema.safeParse(input);
  if (!parsed.success) {
    redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  // Detect duplicate invoice numbers (global) when provided.
  const invNo = d.invoiceNumber?.trim() ? d.invoiceNumber.trim() : "";
  if (invNo) {
    const dup = await service.from("stock_deliveries").select("id", { count: "exact", head: true }).eq("invoice_number", invNo);
    if (dup.error) {
      redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent(formatPostgrestError(dup.error))}`);
    }
    if ((dup.count ?? 0) > 0) {
      redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent("Dit factuurnummer bestaat al.")}`);
    }
  }

  const { data: delivery, error: de } = await service
    .from("stock_deliveries")
    .insert({
      invoice_date: d.invoiceDate?.trim() ? d.invoiceDate.trim() : null,
      supplier: d.supplier?.trim() || null,
      invoice_number: invNo || null,
      invoice_total_incl_cents: d.invoiceTotalInclCents ?? null
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
    quantity_initial: line.quantity,
    quantity_received: line.quantity,
    quantity_remaining: line.quantity,
    variant_segment: line.variantSegment,
    size_label: line.sizeLabel.trim(),
    unit_purchase_excl_cents: line.unitPurchaseExclCents,
    unit_printing_excl_cents: line.unitPrintingExclCents,
    note
  }));

  const { error: be } = await service.from("stock_batches").insert(batchRows);
  if (be) {
    await service.from("stock_deliveries").delete().eq("id", delivery.id);
    redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent(be.message)}`);
  }

  // Sanity check: als batches niet bestaan, is er iets mis (schema mismatch / trigger / silent failure).
  const { count: batchCount, error: bcErr } = await service
    .from("stock_batches")
    .select("*", { count: "exact", head: true })
    .eq("stock_delivery_id", delivery.id);
  if (bcErr) {
    await service.from("stock_deliveries").delete().eq("id", delivery.id);
    redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent(formatPostgrestError(bcErr))}`);
  }
  if (!batchCount || batchCount < 1) {
    await service.from("stock_deliveries").delete().eq("id", delivery.id);
    redirect(
      `/dashboard/stock/levering/nieuw?error=${encodeURIComponent(
        "Levering is opgeslagen, maar er zijn geen voorraadregels (batches) aangemaakt. Controleer je database-migraties voor stock_batches (kolommen/constraints)."
      )}`
    );
  }

  redirect("/dashboard/stock?ok=1");
}

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

  // Detect duplicate invoice numbers (excluding this delivery) when provided.
  const invNo = d.invoiceNumber?.trim() ? d.invoiceNumber.trim() : "";
  if (invNo) {
    const dup = await service
      .from("stock_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("invoice_number", invNo)
      .neq("id", deliveryId);
    if (dup.error) {
      redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(dup.error))}`);
    }
    if ((dup.count ?? 0) > 0) {
      redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent("Dit factuurnummer bestaat al.")}`);
    }
  }

  // Alleen bewerken als niets verbruikt is.
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
        "Deze levering kan niet meer worden bewerkt omdat er al voorraad uit is verbruikt. Maak een correctielevering."
      )}`
    );
  }

  if (batchIds.length > 0) {
    const cons = await service
      .from("stock_consumptions")
      .select("*", { count: "exact", head: true })
      .in("stock_batch_id", batchIds);
    if (cons.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(cons.error))}`);
    if ((cons.count ?? 0) > 0) {
      redirect(
        `/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(
          "Deze levering kan niet meer worden bewerkt omdat er al voorraadmutaties aan gekoppeld zijn. Maak een correctielevering."
        )}`
      );
    }
  }

  const { error: upErr } = await service
    .from("stock_deliveries")
    .update({
      invoice_date: d.invoiceDate?.trim() ? d.invoiceDate.trim() : null,
      supplier: d.supplier?.trim() || null,
      invoice_number: invNo || null,
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

  const del = await service.from("stock_batches").delete().eq("stock_delivery_id", deliveryId);
  if (del.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(del.error))}`);

  const batchRows = d.lines.map((line) => ({
    product_id: line.productId,
    stock_delivery_id: deliveryId,
    received_at: receivedAtIso,
    quantity_initial: line.quantity,
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

  const { count: batchCount, error: bcErr } = await service
    .from("stock_batches")
    .select("*", { count: "exact", head: true })
    .eq("stock_delivery_id", deliveryId);
  if (bcErr) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(bcErr))}`);
  if (!batchCount || batchCount < 1) {
    redirect(
      `/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(
        "Opgeslagen, maar er zijn geen voorraadregels (batches) aangemaakt. Controleer je database-migraties voor stock_batches."
      )}`
    );
  }

  redirect(`/dashboard/stock/levering/${deliveryId}/edit?ok=1`);
}

export async function deleteStockDeliveryAction(deliveryId: string) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=Geen%20toegang`);

  const service = createSupabaseServiceClient();

  // Block deletion if any stock from this delivery has been consumed.
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
        "Deze levering kan niet worden verwijderd omdat er al voorraad uit is verbruikt."
      )}`
    );
  }

  if (batchIds.length > 0) {
    const cons = await service
      .from("stock_consumptions")
      .select("*", { count: "exact", head: true })
      .in("stock_batch_id", batchIds);
    if (cons.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(cons.error))}`);
    if ((cons.count ?? 0) > 0) {
      redirect(
        `/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(
          "Deze levering kan niet worden verwijderd omdat er al voorraadmutaties aan gekoppeld zijn."
        )}`
      );
    }
  }

  const delBatches = await service.from("stock_batches").delete().eq("stock_delivery_id", deliveryId);
  if (delBatches.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(delBatches.error))}`);

  const delDelivery = await service.from("stock_deliveries").delete().eq("id", deliveryId);
  if (delDelivery.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(delDelivery.error))}`);

  redirect("/dashboard/stock/levering/nieuw?ok=deleted");
}

