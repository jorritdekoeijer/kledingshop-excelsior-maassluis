import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOrderConfirmationEmail } from "@/lib/email/send-order-confirmation";
import { itemsToHtmlList } from "@/lib/email/order-email-templates";

/** Na succesvolle betaling: één bevestigingsmail (SMTP uit dashboard). */
export async function maybeSendOrderConfirmationAfterPayment(svc: SupabaseClient, orderId: string) {
  const { data: row } = await svc
    .from("orders")
    .select("guest_email, guest_name, confirmation_sent_at, public_token, total_cents, status, fulfillment_error, order_number")
    .eq("id", orderId)
    .maybeSingle();

  if (!row || row.confirmation_sent_at) return;
  if (row.status !== "new_order") return;
  if (!row.guest_email) return;
  const token = String(row.public_token ?? "").trim();
  if (!token) return;

  const { data: items } = await svc
    .from("order_items")
    .select("quantity,variant_segment,size_label,products(name)")
    .eq("order_id", orderId);

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
    guestEmail: row.guest_email,
    guestName: row.guest_name,
    publicToken: token,
    totalCents: row.total_cents,
    fulfillmentError: row.fulfillment_error,
    orderNumber: row.order_number,
    itemsHtml: itemsToHtmlList(lines)
  });

  if (ok) {
    await svc.from("orders").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", orderId);
  }
}
