import type { ProductUpsertParsed } from "@/lib/dashboard/product-form-parse";
import type { ProductVariantBlock } from "@/lib/validation/products";

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

/**
 * Rij voor insert/update: alleen kolommen die op public.products bestaan.
 * - price_cents komt uit de parse (minimum van variant sale_cents, incl. btw).
 * - temporary_discount_percent komt uit het formulierveld discountPercent.
 */
export function productParsedToDbRow(d: ProductUpsertParsed) {
  return {
    name: d.name,
    slug: d.slug,
    description: d.description,
    price_cents: d.priceCents,
    temporary_discount_percent: d.temporaryDiscountPercent,
    active: d.active,
    product_details: d.productDetails,
    variant_youth: variantBlockToDbJson(d.variantYouth),
    variant_adult: variantBlockToDbJson(d.variantAdult)
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
