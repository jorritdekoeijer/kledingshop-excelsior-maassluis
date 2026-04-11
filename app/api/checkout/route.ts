import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/checkout/site-url";
import { mollieCreatePayment } from "@/lib/mollie/client";
import { getSettingService } from "@/lib/settings-service";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { checkoutRequestSchema } from "@/lib/validation/checkout";
import { mollieSettingsSchema } from "@/lib/validation/settings";

export const runtime = "nodejs";

async function availableStock(
  svc: ReturnType<typeof createSupabaseServiceClient>,
  productId: string
): Promise<number> {
  const { data, error } = await svc.from("stock_batches").select("quantity_remaining").eq("product_id", productId);
  if (error) throw error;
  return (data ?? []).reduce((s, r) => s + (r.quantity_remaining ?? 0), 0);
}

function mergeLines(items: { productId: string; quantity: number }[]) {
  const m = new Map<string, number>();
  for (const it of items) {
    m.set(it.productId, (m.get(it.productId) ?? 0) + it.quantity);
  }
  return [...m.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" }, { status: 400 });
  }

  const rawMollie = await getSettingService("mollie");
  const mollieParsed = mollieSettingsSchema.safeParse(rawMollie);
  if (!mollieParsed.success) {
    return NextResponse.json({ error: "Mollie is niet geconfigureerd in het dashboard." }, { status: 503 });
  }

  const lines = mergeLines(parsed.data.items);
  const svc = createSupabaseServiceClient();

  const productIds = lines.map((l) => l.productId);
  const { data: products, error: pe } = await svc
    .from("products")
    .select("id,price_cents,active")
    .in("id", productIds);
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  for (const id of productIds) {
    const p = byId.get(id);
    if (!p || !p.active) {
      return NextResponse.json({ error: "Een of meer producten zijn niet beschikbaar." }, { status: 400 });
    }
  }

  for (const line of lines) {
    const need = line.quantity;
    const have = await availableStock(svc, line.productId);
    if (have < need) {
      return NextResponse.json(
        { error: "Niet genoeg voorraad voor alle gekozen hoeveelheden. Pas je winkelmand aan." },
        { status: 409 }
      );
    }
  }

  let totalCents = 0;
  const orderLines: {
    product_id: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }[] = [];

  for (const line of lines) {
    const p = byId.get(line.productId)!;
    const unit = p.price_cents;
    const lineTotal = unit * line.quantity;
    totalCents += lineTotal;
    orderLines.push({
      product_id: line.productId,
      quantity: line.quantity,
      unit_price_cents: unit,
      line_total_cents: lineTotal
    });
  }

  const addr = parsed.data.shippingAddress;
  const shipping_address = {
    line1: addr.line1,
    line2: addr.line2 ?? "",
    postalCode: addr.postalCode,
    city: addr.city,
    country: addr.country
  };

  const { data: orderRow, error: oe } = await svc
    .from("orders")
    .insert({
      user_id: null,
      status: "pending_payment",
      total_cents: totalCents,
      guest_email: parsed.data.guestEmail,
      guest_name: parsed.data.guestName,
      guest_phone: parsed.data.guestPhone?.trim() || null,
      shipping_address
    })
    .select("id, public_token")
    .single();

  if (oe || !orderRow) {
    return NextResponse.json({ error: oe?.message ?? "Order aanmaken mislukt" }, { status: 500 });
  }

  const { error: oie } = await svc.from("order_items").insert(
    orderLines.map((l) => ({
      order_id: orderRow.id,
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
      line_total_cents: l.line_total_cents
    }))
  );

  if (oie) {
    await svc.from("orders").delete().eq("id", orderRow.id);
    return NextResponse.json({ error: oie.message }, { status: 500 });
  }

  const site = getSiteUrl();
  const value = (totalCents / 100).toFixed(2);
  const apiKey = mollieParsed.data.apiKey;

  try {
    const payment = await mollieCreatePayment(apiKey, {
      amount: { currency: "EUR", value },
      description: `Excelsior kleding — ${String(orderRow.id).slice(0, 8)}`,
      redirectUrl: `${site}/checkout/bedankt?token=${orderRow.public_token}`,
      webhookUrl: `${site}/api/mollie/webhook`,
      metadata: { order_id: orderRow.id }
    });

    const checkoutHref = payment._links?.checkout?.href;
    if (!checkoutHref) {
      throw new Error("Mollie gaf geen checkout-URL");
    }

    const { error: me } = await svc.from("mollie_payments").insert({
      order_id: orderRow.id,
      mollie_payment_id: payment.id,
      status: payment.status,
      raw: payment as unknown as Record<string, unknown>
    });
    if (me) throw me;

    return NextResponse.json({
      checkoutUrl: checkoutHref,
      orderId: orderRow.id,
      publicToken: orderRow.public_token
    });
  } catch (e) {
    await svc.from("orders").delete().eq("id", orderRow.id);
    const msg = e instanceof Error ? e.message : "Betaling starten mislukt";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
