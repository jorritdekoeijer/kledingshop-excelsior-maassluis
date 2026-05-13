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

type CheckoutSetComponentLine = {
  productId: string;
  quantity: number;
  variant?: "youth" | "adult" | "socks" | "shoes" | "onesize";
  size?: string;
};

type CheckoutLine = {
  productId: string;
  quantity: number;
  variant?: "youth" | "adult" | "socks" | "shoes" | "onesize";
  size?: string;
  jerseyNumber?: string;
  isSet?: boolean;
  setComponents?: CheckoutSetComponentLine[];
};

function mergeCheckoutLines(items: CheckoutLine[]): CheckoutLine[] {
  const m = new Map<string, CheckoutLine>();
  for (const it of items) {
    if (it.isSet) {
      // Sets blijven aparte regels (uniek per setlijn-combinatie); we mergen ze niet automatisch
      // omdat de combinatie van componenten + maten de identiteit bepaalt.
      const compKey = (it.setComponents ?? [])
        .map((c) => `${c.productId}|${c.variant ?? ""}|${c.size ?? ""}|q${c.quantity}`)
        .join("__");
      const key = `SET\u0001${it.productId}\u0001${compKey}`;
      const prev = m.get(key);
      if (prev) prev.quantity += it.quantity;
      else m.set(key, { ...it });
      continue;
    }
    const key = `${it.productId}\u0001${it.variant ?? ""}\u0001${it.size ?? ""}\u0001${it.jerseyNumber ?? ""}`;
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

  // Verzamel ALLE benodigde product-id's (set-zelf + alle componenten + normale regels)
  const allProductIds = new Set<string>();
  for (const l of lines) {
    allProductIds.add(l.productId);
    if (l.isSet) {
      for (const c of l.setComponents ?? []) allProductIds.add(c.productId);
    }
  }

  const { data: products, error: pe } = await svc
    .from("products")
    .select(
      "id,is_set,price_cents,temporary_discount_percent,active,allow_jersey_number,jersey_number_sale_cents,jersey_number_purchase_single_excl_cents,jersey_number_purchase_double_excl_cents,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize"
    )
    .in("id", [...allProductIds]);
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  // Set-producten: hun zichtbaarheid hangt aan active=true (zoals normaal).
  // Componenten van een actieve set zijn ook leesbaar via RLS (zie migration 0043).
  for (const id of allProductIds) {
    const p = byId.get(id);
    if (!p) {
      return NextResponse.json({ error: "Een of meer producten zijn niet beschikbaar." }, { status: 400 });
    }
  }
  // Set-product zelf én normale producten moeten zichtbaar zijn voor de bezoeker.
  for (const l of lines) {
    const p = byId.get(l.productId)!;
    if (!p.active) {
      return NextResponse.json({ error: "Een of meer producten zijn niet beschikbaar." }, { status: 400 });
    }
    if (l.isSet && !(p as any).is_set) {
      return NextResponse.json({ error: "Setregel verwijst niet naar een set-product." }, { status: 400 });
    }
    if (!l.isSet && (p as any).is_set) {
      return NextResponse.json(
        { error: "Een set-product kan alleen als 'set' worden gekocht. Voeg het opnieuw toe." },
        { status: 400 }
      );
    }
  }

  // Voor elke set: controleer dat de meegestuurde componenten exact matchen met de definitie.
  const setComponentsBySet = new Map<string, { component_product_id: string; quantity: number }[]>();
  const setIds = [...new Set(lines.filter((l) => l.isSet).map((l) => l.productId))];
  if (setIds.length > 0) {
    const { data: defs, error: psErr } = await svc
      .from("product_set_components")
      .select("set_product_id,component_product_id,quantity")
      .in("set_product_id", setIds);
    if (psErr) return NextResponse.json({ error: psErr.message }, { status: 500 });
    for (const id of setIds) setComponentsBySet.set(id, []);
    for (const row of defs ?? []) {
      const arr = setComponentsBySet.get(row.set_product_id as string) ?? [];
      arr.push({
        component_product_id: row.component_product_id as string,
        quantity: Number(row.quantity ?? 1)
      });
      setComponentsBySet.set(row.set_product_id as string, arr);
    }
  }

  for (const line of lines) {
    if (!line.isSet) continue;
    const def = setComponentsBySet.get(line.productId) ?? [];
    if (def.length === 0) {
      return NextResponse.json({ error: "Set heeft geen componenten meer. Verwijder de regel." }, { status: 400 });
    }
    const got = line.setComponents ?? [];
    if (got.length !== def.length) {
      return NextResponse.json({ error: "Set-componenten kloppen niet meer. Voeg de set opnieuw toe." }, { status: 400 });
    }
    // We controleren op (component_product_id, quantity) als een multiset.
    const want = new Map<string, number>();
    for (const d of def) want.set(`${d.component_product_id}#${d.quantity}`, (want.get(`${d.component_product_id}#${d.quantity}`) ?? 0) + 1);
    const have = new Map<string, number>();
    for (const g of got) have.set(`${g.productId}#${g.quantity}`, (have.get(`${g.productId}#${g.quantity}`) ?? 0) + 1);
    let okShape = want.size === have.size;
    if (okShape) {
      for (const [k, v] of want) {
        if (have.get(k) !== v) { okShape = false; break; }
      }
    }
    if (!okShape) {
      return NextResponse.json({ error: "Set-componenten kloppen niet meer. Voeg de set opnieuw toe." }, { status: 400 });
    }
  }

  // Voorraadcheck: normale regels op (product, variant, size); set-regels per component.
  for (const line of lines) {
    if (line.isSet) {
      for (const c of line.setComponents ?? []) {
        const have = await sumAvailableStockForLine(svc, c.productId, c.variant ?? null, c.size ?? null);
        const needed = c.quantity * line.quantity;
        if (have < needed) {
          return NextResponse.json(
            { error: "Niet genoeg voorraad voor alle gekozen hoeveelheden. Pas je winkelmand aan." },
            { status: 409 }
          );
        }
      }
      continue;
    }
    const have = await sumAvailableStockForLine(svc, line.productId, line.variant ?? null, line.size ?? null);
    if (have < line.quantity) {
      return NextResponse.json(
        { error: "Niet genoeg voorraad voor alle gekozen hoeveelheden. Pas je winkelmand aan." },
        { status: 409 }
      );
    }
  }

  let totalCents = 0;

  type ParentOrderLine = {
    product_id: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    variant_segment: string | null;
    size_label: string | null;
    jersey_number: string | null;
    jersey_number_sale_cents: number | null;
    jersey_number_purchase_excl_cents: number | null;
    is_set_parent: boolean;
    components?: {
      product_id: string;
      quantity: number;
      variant_segment: string | null;
      size_label: string | null;
    }[];
  };
  const parentLines: ParentOrderLine[] = [];

  for (const line of lines) {
    if (line.isSet) {
      const p = byId.get(line.productId)!;
      // Validatie maten per component
      for (const c of line.setComponents ?? []) {
        const cp = byId.get(c.productId);
        if (!cp) {
          return NextResponse.json({ error: "Een component van de set is niet beschikbaar." }, { status: 400 });
        }
        if (
          !lineSizeAllowed(
            c.variant,
            c.size,
            cp.variant_youth as unknown,
            cp.variant_adult as unknown,
            (cp as any).variant_socks as unknown,
            (cp as any).variant_shoes as unknown,
            (cp as any).variant_onesize as unknown
          )
        ) {
          return NextResponse.json(
            { error: "Ongeldige maat voor een component in een set. Pas je winkelmand aan." },
            { status: 400 }
          );
        }
      }
      const setUnit = Math.max(0, Number(p.price_cents ?? 0));
      const setLineTotal = setUnit * line.quantity;
      totalCents += setLineTotal;
      parentLines.push({
        product_id: line.productId,
        quantity: line.quantity,
        unit_price_cents: setUnit,
        line_total_cents: setLineTotal,
        variant_segment: null,
        size_label: null,
        jersey_number: null,
        jersey_number_sale_cents: null,
        jersey_number_purchase_excl_cents: null,
        is_set_parent: true,
        components: (line.setComponents ?? []).map((c) => ({
          product_id: c.productId,
          quantity: c.quantity * line.quantity,
          variant_segment: c.variant ?? null,
          size_label: c.size?.trim() || null
        }))
      });
      continue;
    }

    const p = byId.get(line.productId)!;
    if (
      !lineSizeAllowed(
        line.variant,
        line.size,
        p.variant_youth as unknown,
        p.variant_adult as unknown,
        (p as any).variant_socks as unknown,
        (p as any).variant_shoes as unknown,
        (p as any).variant_onesize as unknown
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
      variant_onesize: (p as any).variant_onesize,
      variant: line.variant
    });
    const jersey = (line.jerseyNumber ?? "").trim();
    const jerseyAllowed = Boolean((p as any).allow_jersey_number ?? false);
    const jerseySale = jersey && jerseyAllowed ? Math.max(0, Number((p as any).jersey_number_sale_cents ?? 0)) : 0;
    if (jersey && !/^\d{1,3}$/.test(jersey)) {
      return NextResponse.json({ error: "Ongeldig rugnummer. Pas je winkelmand aan." }, { status: 400 });
    }
    if (jersey && !jerseyAllowed) {
      return NextResponse.json({ error: "Rugnummer is niet beschikbaar voor een of meer regels." }, { status: 400 });
    }
    const jerseyPurchaseExcl =
      jersey && jerseyAllowed
        ? (() => {
            const n = Number(jersey);
            const single = Math.max(0, Number((p as any).jersey_number_purchase_single_excl_cents ?? 0));
            const dbl = Math.max(0, Number((p as any).jersey_number_purchase_double_excl_cents ?? 0));
            if (!Number.isFinite(n)) return single;
            return n >= 10 ? dbl : single;
          })()
        : 0;

    const unitWithJersey = unit + jerseySale;
    const lineTotal = unitWithJersey * line.quantity;
    totalCents += lineTotal;
    parentLines.push({
      product_id: line.productId,
      quantity: line.quantity,
      unit_price_cents: unitWithJersey,
      line_total_cents: lineTotal,
      variant_segment: line.variant ?? null,
      size_label: line.size?.trim() || null,
      jersey_number: jersey || null,
      jersey_number_sale_cents: jersey ? jerseySale : null,
      jersey_number_purchase_excl_cents: jersey ? jerseyPurchaseExcl : null,
      is_set_parent: false
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

  // Schrijf eerst alle parent-regels (set én normaal) en daarna de componenten,
  // zodat we ze met set_order_item_id kunnen koppelen.
  const parentRows = parentLines.map((l) => ({
    order_id: orderRow.id,
    product_id: l.product_id,
    quantity: l.quantity,
    unit_price_cents: l.unit_price_cents,
    line_total_cents: l.line_total_cents,
    variant_segment: l.variant_segment,
    size_label: l.size_label,
    jersey_number: l.jersey_number,
    jersey_number_sale_cents: l.jersey_number_sale_cents,
    jersey_number_purchase_excl_cents: l.jersey_number_purchase_excl_cents
  }));
  const { data: insertedParents, error: oie } = await svc
    .from("order_items")
    .insert(parentRows)
    .select("id");

  if (oie || !insertedParents) {
    await svc.from("orders").delete().eq("id", orderRow.id);
    return NextResponse.json({ error: oie?.message ?? "Order opslaan mislukt" }, { status: 500 });
  }

  const componentRows: {
    order_id: string;
    product_id: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    variant_segment: string | null;
    size_label: string | null;
    set_order_item_id: string;
  }[] = [];
  parentLines.forEach((pl, i) => {
    if (!pl.is_set_parent || !pl.components) return;
    const parentId = insertedParents[i]?.id as string | undefined;
    if (!parentId) return;
    for (const c of pl.components) {
      componentRows.push({
        order_id: orderRow.id,
        product_id: c.product_id,
        quantity: c.quantity,
        unit_price_cents: 0,
        line_total_cents: 0,
        variant_segment: c.variant_segment,
        size_label: c.size_label,
        set_order_item_id: parentId
      });
    }
  });

  if (componentRows.length > 0) {
    const { error: cie } = await svc.from("order_items").insert(componentRows);
    if (cie) {
      await svc.from("orders").delete().eq("id", orderRow.id);
      return NextResponse.json({ error: cie.message }, { status: 500 });
    }
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
