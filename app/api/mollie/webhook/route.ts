import { NextResponse } from "next/server";
import { maybeSendOrderConfirmationAfterPayment } from "@/lib/email/maybe-send-order-confirmation";
import { mollieGetPayment } from "@/lib/mollie/client";
import { parseMollieWebhookPaymentId, verifyMollieWebhookSignature } from "@/lib/mollie/verify-webhook";
import { getSettingService } from "@/lib/settings-service";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { mollieSettingsSchema } from "@/lib/validation/settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig =
    request.headers.get("x-mollie-signature") ??
    request.headers.get("X-Mollie-Signature") ??
    null;

  const rawMollie = await getSettingService("mollie");
  const mollieParsed = mollieSettingsSchema.safeParse(rawMollie);
  if (!mollieParsed.success) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (sig) {
    const secret = mollieParsed.data.webhookSecret;
    if (!secret || !verifyMollieWebhookSignature(rawBody, sig, secret)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const paymentId = parseMollieWebhookPaymentId(rawBody);
  if (!paymentId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const apiKey = mollieParsed.data.apiKey;
  let payment: Awaited<ReturnType<typeof mollieGetPayment>>;
  try {
    payment = await mollieGetPayment(apiKey, paymentId);
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const svc = createSupabaseServiceClient();

  const { error: ue } = await svc
    .from("mollie_payments")
    .update({
      status: payment.status,
      raw: payment as unknown as Record<string, unknown>
    })
    .eq("mollie_payment_id", paymentId);

  if (ue) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const orderId = payment.metadata?.order_id;
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ ok: true });
  }

  if (payment.status === "paid") {
    const { error: fe } = await svc.rpc("finalize_order_after_mollie_payment", { p_order_id: orderId });
    if (fe) {
      const msg = fe.message?.slice(0, 2000) ?? "finalize failed";
      await svc
        .from("orders")
        .update({
          status: "paid",
          fulfillment_error: msg,
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);
    }
    await maybeSendOrderConfirmationAfterPayment(svc, orderId);
  }

  return NextResponse.json({ ok: true });
}
