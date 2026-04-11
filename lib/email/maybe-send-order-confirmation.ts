import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOrderConfirmationEmail } from "@/lib/email/send-order-confirmation";

/** Na succesvolle betaling: één bevestigingsmail (SMTP uit dashboard). */
export async function maybeSendOrderConfirmationAfterPayment(svc: SupabaseClient, orderId: string) {
  const { data: row } = await svc
    .from("orders")
    .select("guest_email, guest_name, confirmation_sent_at, public_token, total_cents, status, fulfillment_error")
    .eq("id", orderId)
    .maybeSingle();

  if (!row || row.confirmation_sent_at) return;
  if (row.status !== "paid") return;
  if (!row.guest_email) return;
  const token = String(row.public_token ?? "").trim();
  if (!token) return;

  const ok = await sendOrderConfirmationEmail({
    guestEmail: row.guest_email,
    guestName: row.guest_name,
    publicToken: token,
    totalCents: row.total_cents,
    fulfillmentError: row.fulfillment_error
  });

  if (ok) {
    await svc.from("orders").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", orderId);
  }
}
