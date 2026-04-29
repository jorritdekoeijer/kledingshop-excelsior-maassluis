"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createStockDeliverySchema } from "@/lib/validation/stock-delivery";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";

function mergeDeliveryLinesExact(
  lines: Array<{
    productId: string;
    variantSegment: string;
    sizeLabel: string;
    quantity: number;
    unitPurchaseExclCents: number;
    unitPrintingExclCents: number;
  }>
): typeof lines {
  // Merge only when everything matches, including unit costs.
  const byKey = new Map<string, (typeof lines)[number]>();
  for (const line of lines) {
    const k = `${String(line.productId)}\0${String(line.variantSegment ?? "").trim()}\0${String(line.sizeLabel ?? "").trim()}\0${Number(line.unitPurchaseExclCents ?? 0)}\0${Number(line.unitPrintingExclCents ?? 0)}`;
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { ...line, sizeLabel: String(line.sizeLabel ?? "").trim() });
      continue;
    }
    prev.quantity = Number(prev.quantity ?? 0) + Number(line.quantity ?? 0);
    byKey.set(k, prev);
  }
  return [...byKey.values()];
}

export async function createStockDeliveryAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock/levering/nieuw?error=Geen%20toegang");

  const parsed = createStockDeliverySchema.safeParse(input);
  if (!parsed.success) {
    redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  const mergedLines = mergeDeliveryLinesExact(d.lines as any);

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

  const batchRows = mergedLines.map((line) => ({
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

  const mergedLines = mergeDeliveryLinesExact(d.lines as any);

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

  const { data: batches, error: bErr } = await service
    .from("stock_batches")
    .select(
      "id,product_id,variant_segment,size_label,quantity_initial,quantity_received,quantity_remaining,unit_purchase_excl_cents,unit_printing_excl_cents,received_at,note"
    )
    .eq("stock_delivery_id", deliveryId);
  if (bErr) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(bErr))}`);

  const batchIds = (batches ?? []).map((b: any) => b.id).filter(Boolean);

  // Determine which batches are "locked" (consumed / mutated).
  const consumedByQty = new Set<string>();
  for (const b of batches ?? []) {
    const id = String((b as any).id ?? "");
    if (!id) continue;
    const rem = Number((b as any).quantity_remaining ?? 0);
    const rec = Number((b as any).quantity_received ?? 0);
    if (Number.isFinite(rem) && Number.isFinite(rec) && rem < rec) consumedByQty.add(id);
  }

  const consumedByConsumption = new Set<string>();
  if (batchIds.length > 0) {
    const cons = await service.from("stock_consumptions").select("stock_batch_id").in("stock_batch_id", batchIds).limit(10000);
    if (cons.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(cons.error))}`);
    for (const r of cons.data ?? []) {
      const id = String((r as any).stock_batch_id ?? "");
      if (id) consumedByConsumption.add(id);
    }
  }

  const lockedBatchIds = new Set<string>([...consumedByQty, ...consumedByConsumption]);

  const keyOf = (x: { product_id: any; variant_segment: any; size_label: any }) => {
    const pid = String(x.product_id ?? "");
    const vr = String(x.variant_segment ?? "").trim();
    const sz = String(x.size_label ?? "").trim();
    return `${pid}\0${vr}\0${sz}`;
  };

  // Validate that locked batches are unchanged (cannot delete/modify consumed lines).
  // For locked batches we require an unchanged matching line (same product/variant/size + same received qty + same unit costs).
  const lockedSigCounts = new Map<string, number>();
  const sigOfBatch = (b: any) =>
    `${keyOf(b)}\0${Number(b.quantity_received ?? 0)}\0${Number(b.unit_purchase_excl_cents ?? 0)}\0${Number(b.unit_printing_excl_cents ?? 0)}`;

  for (const b of batches ?? []) {
    const id = String((b as any).id ?? "");
    if (!id || !lockedBatchIds.has(id)) continue;
    const sig = sigOfBatch(b as any);
    lockedSigCounts.set(sig, (lockedSigCounts.get(sig) ?? 0) + 1);
  }

  for (const [sig, need] of lockedSigCounts) {
    let have = 0;
    for (const line of mergedLines as any) {
      const k = `${String(line.productId)}\0${String(line.variantSegment ?? "").trim()}\0${String(line.sizeLabel ?? "").trim()}`;
      const lineSig = `${k}\0${Number(line.quantity ?? 0)}\0${Number(line.unitPurchaseExclCents ?? 0)}\0${Number(line.unitPrintingExclCents ?? 0)}`;
      if (lineSig === sig) have += 1;
    }
    if (have < need) {
      redirect(
        `/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(
          "Je probeert een regel te wijzigen of verwijderen waarvan al voorraad is verbruikt. Pas alleen regels aan waar nog niets van is afgeboekt."
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

  // Delete only batches that are NOT locked; locked batches remain intact.
  const deletableIds = (batches ?? [])
    .map((b: any) => String(b.id ?? ""))
    .filter(Boolean)
    .filter((id: string) => !lockedBatchIds.has(id));
  if (deletableIds.length > 0) {
    const del = await service.from("stock_batches").delete().in("id", deletableIds);
    if (del.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(del.error))}`);
  }

  // Skip inserting lines that are already represented by an existing locked batch (match by signature, count-aware).
  const remainingLockedSigCounts = new Map<string, number>(lockedSigCounts);
  const batchRows = (mergedLines as any[])
    .filter((line) => {
      const k = `${String(line.productId)}\0${String(line.variantSegment ?? "").trim()}\0${String(line.sizeLabel ?? "").trim()}`;
      const sig = `${k}\0${Number(line.quantity ?? 0)}\0${Number(line.unitPurchaseExclCents ?? 0)}\0${Number(line.unitPrintingExclCents ?? 0)}`;
      const n = remainingLockedSigCounts.get(sig) ?? 0;
      if (n > 0) {
        remainingLockedSigCounts.set(sig, n - 1);
        return false;
      }
      return true;
    })
    .map((line) => ({
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

  if (batchRows.length > 0) {
    const ins = await service.from("stock_batches").insert(batchRows);
    if (ins.error) redirect(`/dashboard/stock/levering/${deliveryId}/edit?error=${encodeURIComponent(formatPostgrestError(ins.error))}`);
  }

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

