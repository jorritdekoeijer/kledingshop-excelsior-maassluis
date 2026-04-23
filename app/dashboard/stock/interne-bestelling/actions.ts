"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  createInternalOrderSchema,
  updateInternalOrderMetaSchema,
  updateInternalOrderRebookSchema,
  cancelInternalOrderSchema,
  restoreInternalOrderStockSchema
} from "@/lib/validation/internal-order";

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

export async function updateInternalOrderMetaAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const parsed = updateInternalOrderMetaSchema.safeParse(input);
  if (!parsed.success) {
    redirect(`/dashboard/stock?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  const { error } = await service
    .from("internal_orders")
    .update({
      order_date: d.orderDate,
      cost_group_id: d.costGroupId,
      note: d.note
    })
    .eq("id", d.id);

  if (error) {
    redirect(`/dashboard/stock/interne-bestelling/${encodeURIComponent(d.id)}/edit?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/dashboard/stock/interne-bestelling/${encodeURIComponent(d.id)}?ok=1`);
}

export async function updateInternalOrderRebookAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const parsed = updateInternalOrderRebookSchema.safeParse(input);
  if (!parsed.success) {
    redirect(`/dashboard/stock?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  const { data: orderId, error } = await service.rpc("update_internal_order_and_rebook", {
    p_internal_order_id: d.id,
    p_order_date: d.orderDate,
    p_cost_group_id: d.costGroupId,
    p_note: d.note,
    p_lines: d.lines
  });

  if (error || !orderId) {
    redirect(
      `/dashboard/stock/interne-bestelling/${encodeURIComponent(d.id)}/edit?error=${encodeURIComponent(
        error?.message ?? "Opslaan mislukt"
      )}`
    );
  }

  redirect(`/dashboard/stock/interne-bestelling/${encodeURIComponent(d.id)}?ok=1`);
}

export async function cancelInternalOrderAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const parsed = cancelInternalOrderSchema.safeParse(input);
  if (!parsed.success) {
    redirect(`/dashboard/stock?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  const { data: orderId, error } = await service.rpc("cancel_internal_order", {
    p_internal_order_id: d.id,
    p_cancel_note: d.cancelNote ?? ""
  });

  if (error || !orderId) {
    redirect(`/dashboard/stock/interne-bestelling/${encodeURIComponent(d.id)}?error=${encodeURIComponent(error?.message ?? "Annuleren mislukt")}`);
  }

  redirect(`/dashboard/stock/interne-bestelling/${encodeURIComponent(d.id)}?ok=1`);
}

export async function restoreInternalOrderStockAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const parsed = restoreInternalOrderStockSchema.safeParse(input);
  if (!parsed.success) {
    redirect(`/dashboard/stock?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();

  const { data: orderId, error } = await service.rpc("restore_internal_order_stock", {
    p_internal_order_id: d.id
  });

  if (error || !orderId) {
    redirect(
      `/dashboard/stock/interne-bestelling/${encodeURIComponent(d.id)}?error=${encodeURIComponent(
        error?.message ?? "Voorraad herstellen mislukt"
      )}`
    );
  }

  redirect(`/dashboard/stock/interne-bestelling/${encodeURIComponent(d.id)}?ok=1`);
}

