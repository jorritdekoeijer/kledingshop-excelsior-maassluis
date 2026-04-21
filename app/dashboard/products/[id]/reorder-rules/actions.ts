"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";
import { activeSizesInTemplateOrder, variantBlockToDbJson } from "@/lib/dashboard/product-db-row";
import { normalizeVariantBlock } from "@/lib/shop/product-json";
import { ADULT_SIZE_OPTIONS, ONESIZE_SIZE_OPTIONS, SHOES_SIZE_OPTIONS, SOCKS_SIZE_OPTIONS, YOUTH_SIZE_OPTIONS } from "@/lib/products/variant-constants";
import { upsertReorderRulesSchema } from "@/lib/validation/reorder-rules";

function parseJsonField(raw: FormDataEntryValue | null, fallback: unknown): unknown {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }
}

export async function updateReorderRules(productId: string, formData: FormData) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const rawRules = parseJsonField(formData.get("rulesJson"), []);
  const parsed = upsertReorderRulesSchema.safeParse({
    productId,
    rules: rawRules
  });
  if (!parsed.success) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const service = createSupabaseServiceClient();

  // Upsert alle regels; UI stuurt ook inactieve mee, zodat je ze snel weer kunt activeren.
  const rows = parsed.data.rules.map((r) => ({
    product_id: productId,
    variant_segment: r.variantSegment,
    size_label: r.sizeLabel,
    is_active: r.isActive,
    threshold_qty: r.thresholdQty,
    target_qty: r.targetQty
  }));

  const { error } = await service.from("stock_reorder_rules").upsert(rows, {
    onConflict: "product_id,variant_segment,size_label"
  });
  if (error) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(error))}`);
  }

  const { data: prod, error: prodErr } = await service
    .from("products")
    .select("variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize,garment_type")
    .eq("id", productId)
    .single();
  if (prodErr || !prod) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(prodErr))}`);
  }

  const garmentType =
    prod.garment_type === "socks"
      ? "socks"
      : prod.garment_type === "shoes"
        ? "shoes"
        : prod.garment_type === "onesize"
          ? "onesize"
          : "clothing";
  const templateYouth = YOUTH_SIZE_OPTIONS;
  const templateAdult = ADULT_SIZE_OPTIONS;
  const templateSocks = SOCKS_SIZE_OPTIONS;
  const templateShoes = SHOES_SIZE_OPTIONS;
  const templateOne = ONESIZE_SIZE_OPTIONS;

  const vy = normalizeVariantBlock(prod.variant_youth);
  const va = normalizeVariantBlock(prod.variant_adult);
  const vs = normalizeVariantBlock((prod as any).variant_socks);
  const vh = normalizeVariantBlock((prod as any).variant_shoes);
  const vo = normalizeVariantBlock((prod as any).variant_onesize);

  const activeYouthLabels = parsed.data.rules.filter((r) => r.variantSegment === "youth" && r.isActive).map((r) => r.sizeLabel);
  const activeAdultLabels = parsed.data.rules.filter((r) => r.variantSegment === "adult" && r.isActive).map((r) => r.sizeLabel);
  const activeSocksLabels = parsed.data.rules.filter((r) => r.variantSegment === "socks" && r.isActive).map((r) => r.sizeLabel);
  const activeShoesLabels = parsed.data.rules.filter((r) => r.variantSegment === "shoes" && r.isActive).map((r) => r.sizeLabel);
  const activeOneLabels = parsed.data.rules.filter((r) => r.variantSegment === "onesize" && r.isActive).map((r) => r.sizeLabel);

  const youthSizes = activeSizesInTemplateOrder(activeYouthLabels, templateYouth);
  const adultSizes = activeSizesInTemplateOrder(activeAdultLabels, templateAdult);
  const socksSizes = activeSizesInTemplateOrder(activeSocksLabels, templateSocks);
  const shoesSizes = activeSizesInTemplateOrder(activeShoesLabels, templateShoes);
  const oneSizes = activeSizesInTemplateOrder(activeOneLabels, templateOne);

  const { error: updErr } = await service
    .from("products")
    .update({
      variant_youth: variantBlockToDbJson({ ...vy, sizes: garmentType === "clothing" ? youthSizes : [] }),
      variant_adult: variantBlockToDbJson({ ...va, sizes: garmentType === "clothing" ? adultSizes : [] }),
      variant_socks: variantBlockToDbJson({ ...vs, sizes: garmentType === "socks" ? socksSizes : [] }),
      variant_shoes: variantBlockToDbJson({ ...vh, sizes: garmentType === "shoes" ? shoesSizes : [] }),
      variant_onesize: variantBlockToDbJson({ ...vo, sizes: garmentType === "onesize" ? oneSizes : [] })
    })
    .eq("id", productId);
  if (updErr) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(updErr))}`);
  }

  redirect(`/dashboard/products/${productId}/edit?ok=1`);
}

/** One-off repair: sync `variant_*.sizes` from active reorder rules (shop reads variant sizes). */
export async function syncVariantSizesFromReorderRules(productId: string) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const service = createSupabaseServiceClient();

  const { data: prod, error: prodErr } = await service
    .from("products")
    .select("variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize,garment_type")
    .eq("id", productId)
    .single();
  if (prodErr || !prod) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(prodErr))}`);
  }

  const { data: rules, error: rrErr } = await service
    .from("stock_reorder_rules")
    .select("variant_segment,size_label,is_active")
    .eq("product_id", productId);
  if (rrErr) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(rrErr))}`);
  }

  const garmentType =
    prod.garment_type === "socks"
      ? "socks"
      : prod.garment_type === "shoes"
        ? "shoes"
        : prod.garment_type === "onesize"
          ? "onesize"
          : "clothing";
  const templateYouth = YOUTH_SIZE_OPTIONS;
  const templateAdult = ADULT_SIZE_OPTIONS;
  const templateSocks = SOCKS_SIZE_OPTIONS;
  const templateShoes = SHOES_SIZE_OPTIONS;
  const templateOne = ONESIZE_SIZE_OPTIONS;

  const vy = normalizeVariantBlock(prod.variant_youth);
  const va = normalizeVariantBlock(prod.variant_adult);
  const vs = normalizeVariantBlock((prod as any).variant_socks);
  const vh = normalizeVariantBlock((prod as any).variant_shoes);
  const vo = normalizeVariantBlock((prod as any).variant_onesize);

  const activeYouthLabels = (rules ?? [])
    .filter((r: any) => r.variant_segment === "youth" && r.is_active)
    .map((r: any) => String(r.size_label));
  const activeAdultLabels = (rules ?? [])
    .filter((r: any) => r.variant_segment === "adult" && r.is_active)
    .map((r: any) => String(r.size_label));
  const activeSocksLabels = (rules ?? [])
    .filter((r: any) => r.variant_segment === "socks" && r.is_active)
    .map((r: any) => String(r.size_label));
  const activeShoesLabels = (rules ?? [])
    .filter((r: any) => r.variant_segment === "shoes" && r.is_active)
    .map((r: any) => String(r.size_label));
  const activeOneLabels = (rules ?? [])
    .filter((r: any) => r.variant_segment === "onesize" && r.is_active)
    .map((r: any) => String(r.size_label));

  const youthSizes = activeSizesInTemplateOrder(activeYouthLabels, templateYouth);
  const adultSizes = activeSizesInTemplateOrder(activeAdultLabels, templateAdult);
  const socksSizes = activeSizesInTemplateOrder(activeSocksLabels, templateSocks);
  const shoesSizes = activeSizesInTemplateOrder(activeShoesLabels, templateShoes);
  const oneSizes = activeSizesInTemplateOrder(activeOneLabels, templateOne);

  const { error: updErr } = await service
    .from("products")
    .update({
      variant_youth: variantBlockToDbJson({ ...vy, sizes: garmentType === "clothing" ? youthSizes : [] }),
      variant_adult: variantBlockToDbJson({ ...va, sizes: garmentType === "clothing" ? adultSizes : [] }),
      variant_socks: variantBlockToDbJson({ ...vs, sizes: garmentType === "socks" ? socksSizes : [] }),
      variant_shoes: variantBlockToDbJson({ ...vh, sizes: garmentType === "shoes" ? shoesSizes : [] }),
      variant_onesize: variantBlockToDbJson({ ...vo, sizes: garmentType === "onesize" ? oneSizes : [] })
    })
    .eq("id", productId);
  if (updErr) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(updErr))}`);
  }

  redirect(`/dashboard/products/${productId}/edit?ok=1`);
}

