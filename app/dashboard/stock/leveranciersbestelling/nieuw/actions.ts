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

  // Bouw PDF en verstuur e-mail
  const productIds = [...new Set(d.lines.map((l) => l.productId))];
  const { data: products, error: pe } = await service
    .from("products")
    .select("id,name,variant_youth,variant_adult")
    .in("id", productIds);
  if (pe || !products) {
    redirect(`/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent(formatPostgrestError(pe) ?? "Producten laden mislukt")}`);
  }
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  const pdfLines = d.lines.map((l) => {
    const p = productMap.get(l.productId) as any;
    const vb = l.variantSegment === "youth" ? normalizeVariantBlock(p?.variant_youth) : normalizeVariantBlock(p?.variant_adult);
    const articleCode = String(vb.model_number ?? "").trim();
    return {
      productName: String(p?.name ?? ""),
      articleCode,
      variantSegment: l.variantSegment,
      sizeLabel: l.sizeLabel.trim(),
      quantity: l.quantity
    };
  });

  const pdf = await buildSupplierOrderPdf({
    orderId: order.id,
    orderDate: d.orderDate,
    supplier: supplier as any,
    note: d.note?.trim() ? d.note.trim() : null,
    lines: pdfLines
  });

  const subject = `Leveranciersbestelling ${d.orderDate} — ${supplier.name}`;
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
      filename: `leveranciersbestelling-${d.orderDate}-${order.id}.pdf`,
      content: pdf,
      contentType: "application/pdf"
    }
  });

  if (!sent) {
    redirect(`/dashboard/stock/leveranciersbestelling/nieuw?error=${encodeURIComponent("E-mail versturen mislukt. Controleer SMTP instellingen.")}`);
  }

  await service.from("supplier_orders").update({ status: "sent" }).eq("id", order.id);

  redirect("/dashboard/stock?ok=1");
}

