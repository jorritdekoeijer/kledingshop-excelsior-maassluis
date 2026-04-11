"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendOrderConfirmationEmail } from "@/lib/email/send-order-confirmation";
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
    .select("id,status,guest_email,guest_name,public_token,total_cents,fulfillment_error")
    .eq("id", parsed.data)
    .maybeSingle();

  if (oe || !order) fail("Order niet gevonden");
  const row = order!;

  if (row.status !== "paid" && row.status !== "fulfilled") {
    fail("Mail kan alleen bij betaalde of afgehandelde orders.");
  }

  if (!row.guest_email?.trim()) {
    fail("Geen e-mailadres op deze order.");
  }

  const token = String(row.public_token ?? "").trim();
  if (!token) fail("Order mist publieke token.");

  const ok = await sendOrderConfirmationEmail({
    guestEmail: row.guest_email.trim(),
    guestName: row.guest_name,
    publicToken: token,
    totalCents: row.total_cents,
    fulfillmentError: row.fulfillment_error,
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
