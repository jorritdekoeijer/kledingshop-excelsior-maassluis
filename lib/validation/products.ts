import { z } from "zod";
import { ADULT_SIZE_OPTIONS, YOUTH_SIZE_OPTIONS } from "@/lib/products/variant-constants";

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

export const productUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  description: z.string().max(20000).optional().nullable(),
  priceCents: z.coerce.number().int().min(0),
  temporaryDiscountPercent: z.coerce.number().min(0).max(100).default(0),
  active: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean()
  ),
  categoryId: z.string().min(1, "Kies een categorie.").uuid("Kies een geldige categorie."),
  productDetails: z.array(productDetailRowSchema).max(40).default([]),
  variantYouth: productVariantBlockSchema,
  variantAdult: productVariantBlockSchema
});

export function validateYouthSizes(sizes: string[]): boolean {
  const allowed = new Set(YOUTH_SIZE_OPTIONS);
  return sizes.every((s) => allowed.has(s as (typeof YOUTH_SIZE_OPTIONS)[number]));
}

export function validateAdultSizes(sizes: string[]): boolean {
  const allowed = new Set(ADULT_SIZE_OPTIONS);
  return sizes.every((s) => allowed.has(s as (typeof ADULT_SIZE_OPTIONS)[number]));
}
