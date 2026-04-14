"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupplierOrderSchema } from "@/lib/validation/supplier-order";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";
import { sendSupplierOrderEmail } from "@/lib/email/send-supplier-order";
import { normalizeVariantBlock } from "@/lib/shop/product-json";
import { buildSupplierOrderPdf } from "@/lib/pdf/supplier-order-pdf";

async function sendOrderEmailAndMarkSent(service: ReturnType<typeof createSupabaseServiceClient>, orderId: string) {
  const { data: order, error: oe } = await service
    .from("supplier_orders")
    .select("id,order_date,supplier_id,supplier,note,status")
    .eq("id", orderId)
    .single();
  if (oe || !order) throw oe ?? new Error("Bestelling niet gevonden");

  const { data: supplier, error: se } = await service
    .from("suppliers")
    .select("id,name,email,phone,address_line1,address_line2,postal_code,city,country")
    .eq("id", (order as any).supplier_id)
    .single();
  if (se || !supplier) throw se ?? new Error("Leverancier niet gevonden");

  const { data: lines, error: le } = await service
    .from("supplier_order_lines")
    .select("product_id,variant_segment,size_label,quantity")
    .eq("supplier_order_id", orderId);
  if (le) throw le;

  const productIds = [...new Set((lines ?? []).map((l: any) => String(l.product_id)))];
  const { data: products, error: pe } = await service
    .from("products")
    .select("id,name,variant_youth,variant_adult")
    .in("id", productIds);
  if (pe || !products) throw pe ?? new Error("Producten laden mislukt");
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  const pdfLines = (lines ?? []).map((l: any) => {
    const p = productMap.get(String(l.product_id)) as any;
    const vb = l.variant_segment === "youth" ? normalizeVariantBlock(p?.variant_youth) : normalizeVariantBlock(p?.variant_adult);
    const articleCode = String(vb.model_number ?? "").trim();
    return {
      productName: String(p?.name ?? ""),
      articleCode,
      variantSegment: l.variant_segment,
      sizeLabel: String(l.size_label ?? "").trim(),
      quantity: Number(l.quantity ?? 0)
    };
  });

  const pdf = await buildSupplierOrderPdf({
    orderId,
    orderDate: String((order as any).order_date ?? ""),
    supplier: supplier as any,
    note: String((order as any).note ?? "").trim() ? String((order as any).note).trim() : null,
    lines: pdfLines
  });

  const subject = `Leveranciersbestelling ${String((order as any).order_date ?? "")} — ${supplier.name}`;
  const text =
    `Beste ${supplier.name},\n\n` +
    `In de bijlage vindt u onze bestellijst (PDF).\n\n` +
    `Met vriendelijke groet,\nKledingcommissie Excelsior Maassluis\n`;
  const html =
    `<p>Beste ${supplier.name},</p>` +
    `<p>In de bijlage vindt u onze bestellijst (PDF).</p>` +
    `<p>Met vriendelijke groet,<br/>Kledingcommissie Excelsior Maassluis</p>`;

  const sent = await sendSupplierOrderEmail({
    to: supplier.email,
    supplierName: supplier.name,
    subject,
    text,
    html,
    attachment: {
      filename: `leveranciersbestelling-${String((order as any).order_date ?? "")}-${orderId}.pdf`,
      content: pdf,
      contentType: "application/pdf"
    }
  });
  if (!sent) throw new Error("E-mail versturen mislukt. Controleer SMTP instellingen.");

  await service.from("supplier_orders").update({ status: "sent" }).eq("id", orderId);
}

export async function createSupplierOrderDraftAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock/leveranciersbestelling/nieuw?error=Geen%20toegang");

  const parsed = createSupplierOrderSchema.safeParse(input);
  if (!parsed.success) {
    redirect(
      `/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Ongeldige invoer"
      )}`
    );
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  const { data: supplier, error: se } = await service
    .from("suppliers")
    .select("id,name,email")
    .eq("id", d.supplierId)
    .single();
  if (se || !supplier) {
    redirect(
      `/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(
        formatPostgrestError(se) ?? "Leverancier niet gevonden"
      )}`
    );
  }

  const { data: order, error: oe } = await service
    .from("supplier_orders")
    .insert({
      order_date: d.orderDate,
      supplier: supplier.name,
      supplier_id: supplier.id,
      note: d.note?.trim() ? d.note.trim() : null,
      status: "draft"
    })
    .select("id")
    .single();
  if (oe || !order) {
    redirect(
      `/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(
        formatPostgrestError(oe) ?? "Opslaan mislukt"
      )}`
    );
  }

  const rows = d.lines.map((l) => ({
    supplier_order_id: order.id,
    product_id: l.productId,
    variant_segment: l.variantSegment,
    size_label: l.sizeLabel.trim(),
    quantity: l.quantity
  }));

  const { error: le } = await service.from("supplier_order_lines").insert(rows);
  if (le) {
    await service.from("supplier_orders").delete().eq("id", order.id);
    redirect(`/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(formatPostgrestError(le))}`);
  }

  redirect(`/dashboard/stock/leveranciersbestelling/nieuw?ok=1&draft=${encodeURIComponent(order.id)}`);
}

export async function sendExistingSupplierOrderAction(orderId: string) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");
  const service = createSupabaseServiceClient();
  try {
    await sendOrderEmailAndMarkSent(service, orderId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Versturen mislukt";
    redirect(`/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(msg)}`);
  }
  redirect(`/dashboard/stock/leveranciersbestelling/nieuw?ok=1&sent=${encodeURIComponent(orderId)}`);
}

export async function createSupplierOrderAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock/leveranciersbestelling/nieuw?error=Geen%20toegang");

  const parsed = createSupplierOrderSchema.safeParse(input);
  if (!parsed.success) {
    redirect(
      `/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Ongeldige invoer"
      )}`
    );
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  const { data: supplier, error: se } = await service
    .from("suppliers")
    .select("id,name,email,phone,address_line1,address_line2,postal_code,city,country")
    .eq("id", d.supplierId)
    .single();
  if (se || !supplier) {
    redirect(`/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(formatPostgrestError(se) ?? "Leverancier niet gevonden")}`);
  }

  const { data: order, error: oe } = await service
    .from("supplier_orders")
    .insert({
      order_date: d.orderDate,
      supplier: supplier.name,
      supplier_id: supplier.id,
      note: d.note?.trim() ? d.note.trim() : null,
      status: "draft"
    })
    .select("id")
    .single();

  if (oe || !order) {
    redirect(`/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(formatPostgrestError(oe) ?? "Opslaan mislukt")}`);
  }

  const rows = d.lines.map((l) => ({
    supplier_order_id: order.id,
    product_id: l.productId,
    variant_segment: l.variantSegment,
    size_label: l.sizeLabel.trim(),
    quantity: l.quantity
  }));

  const { error: le } = await service.from("supplier_order_lines").insert(rows);
  if (le) {
    await service.from("supplier_orders").delete().eq("id", order.id);
    redirect(`/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(formatPostgrestError(le))}`);
  }

  try {
    await sendOrderEmailAndMarkSent(service, order.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Versturen mislukt";
    redirect(`/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(msg)}`);
  }

  redirect("/dashboard/stock?ok=1");
}

