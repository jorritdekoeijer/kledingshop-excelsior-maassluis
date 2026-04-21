import type { ProductUpsertParsed } from "@/lib/dashboard/product-form-parse";
import { ADULT_SIZE_OPTIONS, ONESIZE_SIZE_OPTIONS, SHOES_SIZE_OPTIONS, SOCKS_SIZE_OPTIONS, YOUTH_SIZE_OPTIONS } from "@/lib/products/variant-constants";
import type { GarmentType, ProductVariantBlock } from "@/lib/validation/products";

/**
 * Alleen sleutels voor public.products JSONB-kolommen variant_youth / variant_adult.
 * Geen top-level sale_cents / purchase_cents / model_number — die bestaan niet op de productrij.
 */
export function variantBlockToDbJson(v: ProductVariantBlock) {
  return {
    purchase_cents: v.purchase_cents ?? null,
    sale_cents: v.sale_cents ?? null,
    model_number: v.model_number ?? "",
    sizes: Array.isArray(v.sizes) ? v.sizes : []
  };
}

function sizeTemplateForVariant(garmentType: GarmentType, segment: "youth" | "adult"): readonly string[] {
  if (garmentType === "socks") return SOCKS_SIZE_OPTIONS;
  if (garmentType === "shoes") return SHOES_SIZE_OPTIONS;
  if (garmentType === "onesize") return ONESIZE_SIZE_OPTIONS;
  return segment === "youth" ? YOUTH_SIZE_OPTIONS : ADULT_SIZE_OPTIONS;
}

/** Houdt variant-sizes alleen binnen de voor kledingsoort geldige maatlijst. */
export function filterVariantBlockSizesForGarment(
  garmentType: GarmentType,
  segment: "youth" | "adult",
  block: ProductVariantBlock
): ProductVariantBlock {
  const allowed = new Set(sizeTemplateForVariant(garmentType, segment));
  return { ...block, sizes: (block.sizes ?? []).filter((s) => allowed.has(s)) };
}

/** Actieve maten in vaste volgorde van de template (voor sync naar `variant_*.sizes`). */
export function activeSizesInTemplateOrder(active: string[], template: readonly string[]): string[] {
  const set = new Set(active);
  return template.filter((s) => set.has(s));
}

/**
 * Rij voor insert/update: alleen kolommen die op public.products bestaan.
 * - price_cents komt uit de parse (minimum van variant sale_cents, incl. btw).
 * - temporary_discount_percent komt uit het formulierveld discountPercent.
 */
export function productParsedToDbRow(d: ProductUpsertParsed) {
  const variantYouth = filterVariantBlockSizesForGarment(d.garmentType, "youth", d.variantYouth);
  const variantAdult = filterVariantBlockSizesForGarment(d.garmentType, "adult", d.variantAdult);
  const variantSocks = filterVariantBlockSizesForGarment(d.garmentType, "adult", d.variantSocks);
  const variantShoes = filterVariantBlockSizesForGarment(d.garmentType, "adult", d.variantShoes);
  const variantOneSize = filterVariantBlockSizesForGarment(d.garmentType, "adult", d.variantOneSize);
  return {
    name: d.name,
    slug: d.slug,
    description: d.description,
    price_cents: d.priceCents,
    printing_excl_cents: d.printingExclCents,
    temporary_discount_percent: d.temporaryDiscountPercent,
    active: d.active,
    garment_type: d.garmentType,
    product_details: d.productDetails,
    variant_youth: variantBlockToDbJson(variantYouth),
    variant_adult: variantBlockToDbJson(variantAdult),
    variant_socks: variantBlockToDbJson(variantSocks),
    variant_shoes: variantBlockToDbJson(variantShoes),
    variant_onesize: variantBlockToDbJson(variantOneSize)
  };
}

/**
 * Nieuwe rij: expliciet `image_paths` meegeven (`text[]` NOT NULL, default `'{}'` in DB).
 * Zonder deze sleutel kan PostgREST in sommige setups `null` sturen waardoor de insert faalt.
 * Bij updates geen `image_paths` zetten — bestaande paden niet wissen (foto's staan in `product_images`).
 */
export function productParsedToInsertRow(d: ProductUpsertParsed, categoryId: string) {
  return {
    ...productParsedToDbRow(d),
    category_id: categoryId,
    image_paths: [] as string[]
  };
}
