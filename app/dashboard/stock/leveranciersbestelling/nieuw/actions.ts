"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupplierOrderSchema } from "@/lib/validation/supplier-order";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";

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

  const { data: order, error: oe } = await service
    .from("supplier_orders")
    .insert({
      order_date: d.orderDate,
      supplier: d.supplier?.trim() ? d.supplier.trim() : null,
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

  redirect("/dashboard/stock?ok=1");
}

