import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/checkout/site-url";
import { mollieCreatePayment } from "@/lib/mollie/client";
import { getSettingService } from "@/lib/settings-service";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { orderUnitPriceCentsFromProductRow } from "@/lib/checkout/order-unit-price";
import { lineSizeAllowed } from "@/lib/checkout/validate-line-size";
import { sumAvailableStockForLine } from "@/lib/stock/available-for-line";
import { checkoutRequestSchema } from "@/lib/validation/checkout";
import { mollieSettingsSchema } from "@/lib/validation/settings";

export const runtime = "nodejs";

type CheckoutLine = {
  productId: string;
  quantity: number;
  variant?: "youth" | "adult" | "socks" | "shoes";
  size?: string;
};

function mergeCheckoutLines(items: CheckoutLine[]): CheckoutLine[] {
  const m = new Map<string, CheckoutLine>();
  for (const it of items) {
    const key = `${it.productId}\u0001${it.variant ?? ""}\u0001${it.size ?? ""}`;
    const prev = m.get(key);
    if (prev) prev.quantity += it.quantity;
    else m.set(key, { ...it });
  }
  return [...m.values()];
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

  const lines = mergeCheckoutLines(parsed.data.items);
  const svc = createSupabaseServiceClient();

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const { data: products, error: pe } = await svc
    .from("products")
    .select("id,price_cents,temporary_discount_percent,active,variant_youth,variant_adult,variant_socks,variant_shoes")
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
    const have = await sumAvailableStockForLine(svc, line.productId, line.variant ?? null, line.size ?? null);
    if (have < line.quantity) {
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
    variant_segment: string | null;
    size_label: string | null;
  }[] = [];

  for (const line of lines) {
    const p = byId.get(line.productId)!;
    if (
      !lineSizeAllowed(
        line.variant,
        line.size,
        p.variant_youth as unknown,
        p.variant_adult as unknown,
        (p as any).variant_socks as unknown,
        (p as any).variant_shoes as unknown
      )
    ) {
      return NextResponse.json(
        { error: "Ongeldige maat voor een of meer productregels. Pas je winkelmand aan." },
        { status: 400 }
      );
    }
    const unit = orderUnitPriceCentsFromProductRow({
      price_cents: p.price_cents,
      temporary_discount_percent: p.temporary_discount_percent,
      variant_youth: p.variant_youth,
      variant_adult: p.variant_adult,
      variant_socks: (p as any).variant_socks,
      variant_shoes: (p as any).variant_shoes,
      variant: line.variant
    });
    const lineTotal = unit * line.quantity;
    totalCents += lineTotal;
    orderLines.push({
      product_id: line.productId,
      quantity: line.quantity,
      unit_price_cents: unit,
      line_total_cents: lineTotal,
      variant_segment: line.variant ?? null,
      size_label: line.size?.trim() || null
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
      line_total_cents: l.line_total_cents,
      variant_segment: l.variant_segment,
      size_label: l.size_label
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
