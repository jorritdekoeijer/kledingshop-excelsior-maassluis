"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createInternalOrderSchema } from "@/lib/validation/internal-order";

export async function createInternalOrderAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock/interne-bestelling?error=Geen%20toegang");

  const parsed = createInternalOrderSchema.safeParse(input);
  if (!parsed.success) {
    redirect(
      `/dashboard/stock/interne-bestelling?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Ongeldige invoer"
      )}`
    );
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  const { data: orderId, error } = await service.rpc("create_internal_order_and_consume_stock", {
    p_order_date: d.orderDate,
    p_cost_group_id: d.costGroupId,
    p_note: d.note,
    p_lines: d.lines
  });

  if (error || !orderId) {
    redirect(`/dashboard/stock/interne-bestelling?error=${encodeURIComponent(error?.message ?? "Opslaan mislukt")}`);
  }

  redirect("/dashboard/stock?ok=1");
}

