import { z } from "zod";
import { ADULT_SIZE_OPTIONS, ONESIZE_SIZE_OPTIONS, SHOES_SIZE_OPTIONS, SOCKS_SIZE_OPTIONS, YOUTH_SIZE_OPTIONS } from "@/lib/products/variant-constants";

export const garmentTypeSchema = z.enum(["clothing", "socks", "shoes", "onesize"]);
export type GarmentType = z.infer<typeof garmentTypeSchema>;

const sizeStr = z.string().max(16);

export const productDetailRowSchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().max(500)
});

export const productVariantBlockSchema = z.object({
  purchase_cents: z.number().int().min(0).nullable().optional(),
  sale_cents: z.number().int().min(0).nullable().optional(),
  model_number: z.string().max(120).optional().default(""),
  sizes: z.array(sizeStr).optional().default([])
});

export type ProductDetailRow = z.infer<typeof productDetailRowSchema>;
export type ProductVariantBlock = z.infer<typeof productVariantBlockSchema>;

export const categoryUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80)
});

export const productSetComponentInputSchema = z.object({
  componentProductId: z.string().uuid("Kies een geldig component-product."),
  quantity: z.coerce.number().int().min(1).max(99),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  note: z.string().max(200).optional().default(""),
  /**
   * Optionele keuzegroep (interne key): componenten met dezelfde key binnen één set zijn alternatieven
   * (klant kiest precies één). Leeglaten = altijd inbegrepen.
   */
  optionGroup: z.string().max(60).optional().default(""),
  /**
   * Publiek label voor de keuzegroep dat in de webshop wordt getoond (bv. "Kies je bovenlaag").
   * Alleen relevant als optionGroup is ingevuld. Leeg = generieke tekst in de shop.
   */
  optionGroupLabel: z.string().max(120).optional().default("")
});

export type ProductSetComponentInput = z.infer<typeof productSetComponentInputSchema>;

export const productUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  description: z.string().max(20000).optional().nullable(),
  priceCents: z.coerce.number().int().min(0),
  printingExclCents: z.coerce.number().int().min(0).default(0),
  allowJerseyNumber: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean()
  ).default(false),
  jerseyNumberSaleCents: z.coerce.number().int().min(0).default(0),
  jerseyNumberPurchaseSingleExclCents: z.coerce.number().int().min(0).default(0),
  jerseyNumberPurchaseDoubleExclCents: z.coerce.number().int().min(0).default(0),
  temporaryDiscountPercent: z.coerce.number().min(0).max(100).default(0),
  active: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean()
  ),
  isSet: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean()
  ).default(false),
  setSalePriceInclCents: z.coerce.number().int().min(0).default(0),
  setComponents: z.array(productSetComponentInputSchema).max(20).default([]),
  categoryId: z.string().min(1, "Kies een categorie.").uuid("Kies een geldige categorie."),
  garmentType: z.preprocess(
    (v) => (v === "socks" || v === "shoes" || v === "onesize" ? v : "clothing"),
    garmentTypeSchema
  ),
  productDetails: z.array(productDetailRowSchema).max(40).default([]),
  variantYouth: productVariantBlockSchema,
  variantAdult: productVariantBlockSchema,
  variantSocks: productVariantBlockSchema,
  variantShoes: productVariantBlockSchema,
  variantOneSize: productVariantBlockSchema
});

export function validateYouthSizes(sizes: string[]): boolean {
  const allowed = new Set(YOUTH_SIZE_OPTIONS);
  return sizes.every((s) => allowed.has(s as (typeof YOUTH_SIZE_OPTIONS)[number]));
}

export function validateAdultSizes(sizes: string[]): boolean {
  const allowed = new Set(ADULT_SIZE_OPTIONS);
  return sizes.every((s) => allowed.has(s as (typeof ADULT_SIZE_OPTIONS)[number]));
}

export function validateSockSizes(sizes: string[]): boolean {
  const allowed = new Set(SOCKS_SIZE_OPTIONS);
  return sizes.every((s) => allowed.has(s as (typeof SOCKS_SIZE_OPTIONS)[number]));
}

export function validateShoeSizes(sizes: string[]): boolean {
  const allowed = new Set(SHOES_SIZE_OPTIONS);
  return sizes.every((s) => allowed.has(s as (typeof SHOES_SIZE_OPTIONS)[number]));
}

export function validateOneSizeSizes(sizes: string[]): boolean {
  const allowed = new Set(ONESIZE_SIZE_OPTIONS);
  return sizes.every((s) => allowed.has(s as (typeof ONESIZE_SIZE_OPTIONS)[number]));
}
