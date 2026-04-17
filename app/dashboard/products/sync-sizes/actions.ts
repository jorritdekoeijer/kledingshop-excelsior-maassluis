"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";
import { activeSizesInTemplateOrder, variantBlockToDbJson } from "@/lib/dashboard/product-db-row";
import { normalizeVariantBlock } from "@/lib/shop/product-json";
import { ADULT_SIZE_OPTIONS, SHOES_SIZE_OPTIONS, SOCKS_SIZE_OPTIONS, YOUTH_SIZE_OPTIONS } from "@/lib/products/variant-constants";

export async function syncAllVariantSizesFromReorderRulesAction() {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect(`/dashboard/products?error=${encodeURIComponent("Geen toegang")}`);

  const svc = createSupabaseServiceClient();

  const { data: products, error: pe } = await svc
    .from("products")
    .select("id,garment_type,variant_youth,variant_adult,variant_socks,variant_shoes")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (pe) redirect(`/dashboard/products?error=${encodeURIComponent(formatPostgrestError(pe))}`);

  const { data: rules, error: re } = await svc
    .from("stock_reorder_rules")
    .select("product_id,variant_segment,size_label,is_active")
    .in(
      "product_id",
      (products ?? []).map((p: any) => p.id)
    )
    .limit(50000);
  if (re) redirect(`/dashboard/products?error=${encodeURIComponent(formatPostgrestError(re))}`);

  const byProduct = new Map<string, Array<any>>();
  for (const r of (rules ?? []) as any[]) {
    const pid = String(r.product_id ?? "");
    if (!pid) continue;
    const arr = byProduct.get(pid) ?? [];
    arr.push(r);
    byProduct.set(pid, arr);
  }

  let updated = 0;

  for (const p of (products ?? []) as any[]) {
    const pid = String(p.id);
    const garmentType = p.garment_type === "socks" ? "socks" : p.garment_type === "shoes" ? "shoes" : "clothing";
    const rr = byProduct.get(pid) ?? [];

    const activeYouth = rr.filter((r) => r.variant_segment === "youth" && r.is_active).map((r) => String(r.size_label));
    const activeAdult = rr.filter((r) => r.variant_segment === "adult" && r.is_active).map((r) => String(r.size_label));
    const activeSocks = rr.filter((r) => r.variant_segment === "socks" && r.is_active).map((r) => String(r.size_label));
    const activeShoes = rr.filter((r) => r.variant_segment === "shoes" && r.is_active).map((r) => String(r.size_label));

    const youthSizes = activeSizesInTemplateOrder(activeYouth, YOUTH_SIZE_OPTIONS);
    const adultSizes = activeSizesInTemplateOrder(activeAdult, ADULT_SIZE_OPTIONS);
    const socksSizes = activeSizesInTemplateOrder(activeSocks, SOCKS_SIZE_OPTIONS);
    const shoesSizes = activeSizesInTemplateOrder(activeShoes, SHOES_SIZE_OPTIONS);

    const vy = normalizeVariantBlock(p.variant_youth);
    const va = normalizeVariantBlock(p.variant_adult);
    const vs = normalizeVariantBlock(p.variant_socks);
    const vh = normalizeVariantBlock(p.variant_shoes);

    const next = {
      variant_youth: variantBlockToDbJson({ ...vy, sizes: garmentType === "clothing" ? youthSizes : [] }),
      variant_adult: variantBlockToDbJson({ ...va, sizes: garmentType === "clothing" ? adultSizes : [] }),
      variant_socks: variantBlockToDbJson({ ...vs, sizes: garmentType === "socks" ? socksSizes : [] }),
      variant_shoes: variantBlockToDbJson({ ...vh, sizes: garmentType === "shoes" ? shoesSizes : [] })
    };

    const { error: ue } = await svc.from("products").update(next).eq("id", pid);
    if (ue) redirect(`/dashboard/products?error=${encodeURIComponent(formatPostgrestError(ue))}`);
    updated += 1;
  }

  redirect(`/dashboard/products?ok=sync_sizes&updated=${updated}`);
}

