"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createManualSaleSchema } from "@/lib/validation/manual-sale";
import { normalizeVariantBlock } from "@/lib/shop/product-json";

function variantSaleCents(productRow: any, variant: string | null | undefined): number | null {
  const v = String(variant ?? "").trim();
  const block =
    v === "youth"
      ? normalizeVariantBlock(productRow?.variant_youth)
      : v === "adult"
        ? normalizeVariantBlock(productRow?.variant_adult)
        : v === "socks"
          ? normalizeVariantBlock(productRow?.variant_socks)
          : v === "shoes"
            ? normalizeVariantBlock(productRow?.variant_shoes)
            : v === "onesize"
              ? normalizeVariantBlock(productRow?.variant_onesize)
              : null;
  const sc = block ? block.sale_cents : null;
  return typeof sc === "number" && Number.isFinite(sc) && sc >= 0 ? sc : null;
}

export async function createManualSaleAction(input: unknown) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const parsed = createManualSaleSchema.safeParse(input);
  if (!parsed.success) {
    redirect(`/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const d = parsed.data;
  const service = createSupabaseServiceClient();
  const occurredAt = `${d.saleDate}T12:00:00.000Z`;

  // Verzamel alle productIds (lines + componenten van sets) om verkoopprijzen en set-definities te laden.
  const allProductIds = new Set<string>();
  for (const l of d.lines) {
    allProductIds.add(l.productId);
    if (l.isSet) {
      for (const c of l.components ?? []) allProductIds.add(c.componentProductId);
    }
  }

  const { data: products, error: prodErr } = await service
    .from("products")
    .select(
      "id,name,is_set,price_cents,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize"
    )
    .in("id", [...allProductIds]);
  if (prodErr) {
    redirect(`/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(prodErr.message)}`);
  }
  const byId = new Map((products ?? []).map((p: any) => [p.id, p]));

  // Set-componenten ophalen voor validatie
  const setIds = d.lines.filter((l) => l.isSet).map((l) => l.productId);
  const definedComps = new Map<
    string,
    { componentProductId: string; quantity: number; optionGroup: string | null }[]
  >();
  if (setIds.length > 0) {
    const firstQ = await service
      .from("product_set_components")
      .select("set_product_id,component_product_id,quantity,option_group")
      .in("set_product_id", setIds);
    let comps: any[] | null = null;
    if (firstQ.error) {
      const code = String((firstQ.error as any)?.code ?? "");
      const msg = String((firstQ.error as any)?.message ?? "").toLowerCase();
      if (code === "42703" || msg.includes("option_group")) {
        const fb = await service
          .from("product_set_components")
          .select("set_product_id,component_product_id,quantity")
          .in("set_product_id", setIds);
        if (fb.error) {
          redirect(`/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(fb.error.message)}`);
        }
        comps = (fb.data ?? []).map((r: any) => ({ ...r, option_group: null }));
      } else {
        redirect(`/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(firstQ.error.message)}`);
      }
    } else {
      comps = firstQ.data ?? [];
    }
    for (const row of comps ?? []) {
      const k = row.set_product_id as string;
      const arr = definedComps.get(k) ?? [];
      arr.push({
        componentProductId: row.component_product_id as string,
        quantity: Number(row.quantity ?? 1),
        optionGroup:
          typeof row.option_group === "string" && row.option_group.trim().length > 0
            ? row.option_group.trim()
            : null
      });
      definedComps.set(k, arr);
    }
  }

  // Sanity checks per regel
  for (const l of d.lines) {
    const p = byId.get(l.productId);
    if (!p) {
      redirect(`/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent("Onbekend product op een regel.")}`);
    }
    if (l.isSet) {
      if (!p.is_set) {
        redirect(
          `/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent("Set-vinkje staat aan maar product is geen set.")}`
        );
      }
      const def = definedComps.get(l.productId) ?? [];
      const got = l.components ?? [];
      if (def.length === 0) {
        redirect(
          `/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent("Set-componenten kloppen niet meer. Open opnieuw en kies een set.")}`
        );
      }
      const required = def.filter((d) => !d.optionGroup);
      const groupedDefs = new Map<string, typeof def>();
      for (const d of def) {
        if (!d.optionGroup) continue;
        const arr = groupedDefs.get(d.optionGroup) ?? [];
        arr.push(d);
        groupedDefs.set(d.optionGroup, arr);
      }
      const expectedCount = required.length + groupedDefs.size;
      if (got.length !== expectedCount) {
        redirect(
          `/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent("Set-componenten kloppen niet meer met de productdefinitie.")}`
        );
      }
      const have = new Map<string, number>();
      for (const g of got) {
        const k = `${g.componentProductId}#${g.quantityPerSet}`;
        have.set(k, (have.get(k) ?? 0) + 1);
      }
      const consume = (key: string): boolean => {
        const v = have.get(key) ?? 0;
        if (v <= 0) return false;
        if (v === 1) have.delete(key);
        else have.set(key, v - 1);
        return true;
      };
      let ok = true;
      for (const r of required) {
        if (!consume(`${r.componentProductId}#${r.quantity}`)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (const [, alternatives] of groupedDefs) {
          const matched = alternatives.find((alt) =>
            consume(`${alt.componentProductId}#${alt.quantity}`)
          );
          if (!matched) {
            ok = false;
            break;
          }
        }
      }
      if (ok && have.size > 0) ok = false;
      if (!ok) {
        redirect(
          `/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent("Set-componenten kloppen niet meer met de productdefinitie.")}`
        );
      }
    } else {
      if (p.is_set) {
        redirect(
          `/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent("Voor een set-product moet je de set-modus gebruiken.")}`
        );
      }
      if (!l.variantSegment || !l.sizeLabel || !l.sizeLabel.trim()) {
        redirect(
          `/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent("Kies variant en maat op iedere reguliere regel.")}`
        );
      }
    }
  }

  // 1) Maak manual_sale header
  const { data: sale, error: hErr } = await service
    .from("manual_sales")
    .insert({ sale_date: d.saleDate, note: d.note ? d.note.trim() : null })
    .select("id")
    .single();
  if (hErr || !sale) {
    redirect(`/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(hErr?.message ?? "Header opslaan mislukt")}`);
  }

  // 2) Per regel: maak manual_sale_lines row + boek voorraad af
  for (const l of d.lines) {
    const p = byId.get(l.productId)!;
    let unitRevenue = Math.max(0, Number(l.unitRevenueInclCents ?? 0));
    if (l.isSet) {
      const setPrice = Number(p?.price_cents ?? 0);
      if (setPrice > 0) unitRevenue = setPrice;
    } else {
      const fallback = variantSaleCents(p, l.variantSegment ?? null);
      if (unitRevenue === 0 && fallback != null) unitRevenue = fallback;
    }

    const { data: lineRow, error: lErr } = await service
      .from("manual_sale_lines")
      .insert({
        manual_sale_id: sale.id,
        product_id: l.productId,
        is_set: Boolean(l.isSet),
        quantity: l.quantity,
        unit_revenue_incl_cents: unitRevenue,
        variant_segment: l.isSet ? null : l.variantSegment ?? null,
        size_label: l.isSet ? null : (l.sizeLabel ?? null)
      })
      .select("id")
      .single();
    if (lErr || !lineRow) {
      redirect(`/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(lErr?.message ?? "Regel opslaan mislukt")}`);
    }

    if (l.isSet) {
      for (const c of l.components ?? []) {
        const totalQty = c.quantityPerSet * l.quantity;
        const { error: ce } = await service.rpc("consume_stock_fifo_for_manual_sale_line", {
          p_manual_sale_line_id: lineRow.id,
          p_product_id: c.componentProductId,
          p_quantity: totalQty,
          p_variant: c.variantSegment,
          p_size: c.sizeLabel,
          p_occurred_at: occurredAt
        });
        if (ce) {
          redirect(
            `/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(
              `${ce.message} (set component=${c.componentProductId} · variant=${c.variantSegment} · maat=${c.sizeLabel})`
            )}`
          );
        }
      }
    } else {
      const { error: re } = await service.rpc("consume_stock_fifo_for_manual_sale_line", {
        p_manual_sale_line_id: lineRow.id,
        p_product_id: l.productId,
        p_quantity: l.quantity,
        p_variant: l.variantSegment,
        p_size: l.sizeLabel,
        p_occurred_at: occurredAt
      });
      if (re) {
        redirect(
          `/dashboard/stock/handmatige-verkoop?error=${encodeURIComponent(
            `${re.message} (product=${l.productId} · variant=${l.variantSegment} · maat=${l.sizeLabel})`
          )}`
        );
      }
    }
  }

  redirect("/dashboard/stock?ok=1");
}
