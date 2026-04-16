"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendOrderConfirmationEmail } from "@/lib/email/send-order-confirmation";
import { sendPickupNoticeEmail } from "@/lib/email/send-pickup-notice";
import { itemsToHtmlList } from "@/lib/email/order-email-templates";
import { permissions } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

/** Alleen interne paden naar orderdetail, anders overzicht. */
function redirectAfterOrderAction(formData: FormData, fallback: string): string {
  const next = formData.get("next");
  if (typeof next !== "string") return fallback;
  const t = next.trim();
  if (/^\/dashboard\/orders\/[0-9a-fA-F-]{36}$/.test(t)) return t;
  return fallback;
}

export async function markOrderFulfilled(formData: FormData) {
  const gate = await requirePermission(permissions.orders.write);
  const baseList = "/dashboard/orders";
  if (!gate.ok) redirect(`${baseList}?error=${encodeURIComponent("Geen toegang")}`);

  const raw = formData.get("orderId");
  const parsed = uuid.safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) redirect(`${baseList}?error=${encodeURIComponent("Ongeldige order")}`);

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: le } = await supabase
    .from("orders")
    .select("id,status")
    .eq("id", parsed.data)
    .maybeSingle();

  if (le || !existing) redirect(`${baseList}?error=${encodeURIComponent("Order niet gevonden")}`);
  if (existing.status !== "paid") {
    redirect(`${baseList}?error=${encodeURIComponent("Alleen betaalde orders kunnen op afgehandeld gezet worden.")}`);
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "fulfilled", updated_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("status", "paid");

  if (error) redirect(`${baseList}?error=${encodeURIComponent(error.message)}`);

  const dest = redirectAfterOrderAction(formData, baseList);
  revalidatePath(baseList);
  revalidatePath(dest);
  redirect(`${dest}?ok=fulfilled`);
}

export async function pickOrderItem(formData: FormData) {
  const gate = await requirePermission(permissions.orders.write);
  const baseList = "/dashboard/orders";
  if (!gate.ok) redirect(`${baseList}?error=${encodeURIComponent("Geen toegang")}`);

  const raw = formData.get("orderItemId");
  const parsed = uuid.safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) redirect(`${baseList}?error=${encodeURIComponent("Ongeldige orderregel")}`);

  const next = redirectAfterOrderAction(formData, baseList);
  const supabase = await createSupabaseServerClient();

  // Pick = consume FIFO + mark picked
  const { error } = await supabase.rpc("pick_order_item_and_consume_stock", { p_order_item_id: parsed.data });
  if (error) redirect(`${next}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(baseList);
  revalidatePath(next);
  redirect(`${next}?ok=1`);
}

export async function markOrderReadyForPickup(formData: FormData) {
  const gate = await requirePermission(permissions.orders.write);
  const baseList = "/dashboard/orders";
  if (!gate.ok) redirect(`${baseList}?error=${encodeURIComponent("Geen toegang")}`);

  const raw = formData.get("orderId");
  const parsed = uuid.safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) redirect(`${baseList}?error=${encodeURIComponent("Ongeldige order")}`);

  const next = redirectAfterOrderAction(formData, `${baseList}/${parsed.data}`);
  const supabase = await createSupabaseServerClient();

  const { data: order, error: oe } = await supabase
    .from("orders")
    .select("id,status,guest_email,guest_name,public_token,order_number")
    .eq("id", parsed.data)
    .maybeSingle();
  if (oe || !order) redirect(`${next}?error=${encodeURIComponent("Order niet gevonden")}`);
  if (order.status !== "new_order" && order.status !== "backorder") {
    redirect(`${next}?error=${encodeURIComponent("Order moet in 'Nieuwe bestelling' of 'Backorder' staan.")}`);
  }
  if (!order.guest_email?.trim()) redirect(`${next}?error=${encodeURIComponent("Geen e-mailadres op deze order.")}`);

  const { data: items } = await supabase
    .from("order_items")
    .select("quantity,picked,delivered,products(name)")
    .eq("order_id", parsed.data);

  const ready: Array<{ name: string; quantity: number }> = [];
  const backorder: Array<{ name: string; quantity: number }> = [];

  for (const li of (items ?? []) as any[]) {
    const name = String(li?.products?.name ?? "Product");
    const qty = Number(li?.quantity ?? 1) || 1;
    const delivered = Boolean(li?.delivered);
    if (delivered) continue;
    const picked = Boolean(li?.picked);
    if (picked) ready.push({ name, quantity: qty });
    else backorder.push({ name, quantity: qty });
  }

  const token = String(order.public_token ?? "").trim();
  if (!token) redirect(`${next}?error=${encodeURIComponent("Order mist publieke token.")}`);

  const mail = await sendPickupNoticeEmail({
    guestEmail: order.guest_email.trim(),
    guestName: order.guest_name,
    orderNumber: String(order.order_number ?? "").trim() || order.id.slice(0, 8),
    publicToken: token,
    ready,
    backorder
  });

  if (!mail.ok) redirect(`${next}?error=${encodeURIComponent("SMTP niet geconfigureerd of verzenden mislukt.")}`);

  const { error: ue } = await supabase
    .from("orders")
    .update({
      status: "ready_for_pickup",
      pickup_email_sent_at: new Date().toISOString(),
      pickup_email_kind: mail.kind,
      updated_at: new Date().toISOString()
    })
    .eq("id", parsed.data);
  if (ue) redirect(`${next}?error=${encodeURIComponent(ue.message)}`);

  revalidatePath(baseList);
  revalidatePath(next);
  revalidatePath("/dashboard/orders/afhalen");
  redirect(`${next}?ok=ready`);
}

export async function markOrderPickedUp(formData: FormData) {
  const gate = await requirePermission(permissions.orders.write);
  const baseList = "/dashboard/orders";
  if (!gate.ok) redirect(`${baseList}?error=${encodeURIComponent("Geen toegang")}`);

  const raw = formData.get("orderId");
  const parsed = uuid.safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) redirect(`${baseList}?error=${encodeURIComponent("Ongeldige order")}`);

  const next = redirectAfterOrderAction(formData, `${baseList}/${parsed.data}`);
  const supabase = await createSupabaseServerClient();

  const { data: order } = await supabase.from("orders").select("id,status").eq("id", parsed.data).maybeSingle();
  if (!order) redirect(`${next}?error=${encodeURIComponent("Order niet gevonden")}`);
  if (order.status !== "ready_for_pickup") {
    redirect(`${next}?error=${encodeURIComponent("Order moet op 'Klaar om af te halen' staan.")}`);
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("id,picked,delivered")
    .eq("order_id", parsed.data);

  const undelivered = (items ?? []).filter((li: any) => !li.delivered);
  const ready = undelivered.filter((li: any) => li.picked);
  const missing = undelivered.filter((li: any) => !li.picked);

  // Mark all picked-but-undelivered items as delivered now
  for (const li of ready as any[]) {
    await supabase
      .from("order_items")
      .update({ delivered: true, delivered_at: new Date().toISOString() })
      .eq("id", li.id)
      .eq("delivered", false);
  }

  const nextStatus = missing.length === 0 ? "completed" : "backorder";
  const { error: ue } = await supabase
    .from("orders")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", parsed.data);
  if (ue) redirect(`${next}?error=${encodeURIComponent(ue.message)}`);

  revalidatePath(baseList);
  revalidatePath(next);
  revalidatePath("/dashboard/orders/afhalen");
  redirect(`${next}?ok=pickedup`);
}

export async function resendOrderConfirmationEmail(formData: FormData) {
  const gate = await requirePermission(permissions.orders.write);
  const baseList = "/dashboard/orders";
  if (!gate.ok) redirect(`${baseList}?error=${encodeURIComponent("Geen toegang")}`);

  const raw = formData.get("orderId");
  const parsed = uuid.safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) redirect(`${baseList}?error=${encodeURIComponent("Ongeldige order")}`);

  const detailDefault = `${baseList}/${parsed.data}`;
  const fail = (msg: string): never =>
    redirect(`${redirectAfterOrderAction(formData, detailDefault)}?error=${encodeURIComponent(msg)}`);

  const supabase = await createSupabaseServerClient();
  const { data: order, error: oe } = await supabase
    .from("orders")
    .select("id,status,guest_email,guest_name,public_token,total_cents,fulfillment_error,order_number")
    .eq("id", parsed.data)
    .maybeSingle();

  if (oe || !order) fail("Order niet gevonden");
  const row = order!;

  if (
    row.status !== "new_order" &&
    row.status !== "ready_for_pickup" &&
    row.status !== "backorder" &&
    row.status !== "completed"
  ) {
    fail("Mail kan alleen bij betaalde orders.");
  }

  if (!row.guest_email?.trim()) {
    fail("Geen e-mailadres op deze order.");
  }

  const token = String(row.public_token ?? "").trim();
  if (!token) fail("Order mist publieke token.");

  const { data: items } = await supabase
    .from("order_items")
    .select("quantity,variant_segment,size_label,products(name)")
    .eq("order_id", parsed.data);

  const lines =
    (items ?? []).map((li: any) => ({
      name: [
        String(li?.products?.name ?? "Product"),
        li?.variant_segment ? String(li.variant_segment).toUpperCase() : "",
        li?.size_label ? String(li.size_label) : ""
      ]
        .filter(Boolean)
        .join(" · "),
      quantity: Number(li?.quantity ?? 1) || 1
    })) ?? [];

  const ok = await sendOrderConfirmationEmail({
    guestEmail: row.guest_email.trim(),
    guestName: row.guest_name,
    publicToken: token,
    totalCents: row.total_cents,
    fulfillmentError: row.fulfillment_error,
    orderNumber: row.order_number,
    itemsHtml: itemsToHtmlList(lines),
    isResend: true
  });

  if (!ok) {
    fail("SMTP niet geconfigureerd of verzenden mislukt.");
  }

  const { error: ue } = await supabase
    .from("orders")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", parsed.data);

  if (ue) fail(ue.message);

  const dest = redirectAfterOrderAction(formData, detailDefault);
  revalidatePath(baseList);
  revalidatePath(dest);
  redirect(`${dest}?mail=sent`);
}
