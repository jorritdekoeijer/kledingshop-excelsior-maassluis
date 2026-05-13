import { z } from "zod";

const variantEnum = z.enum(["youth", "adult", "socks", "shoes", "onesize"]);

export const manualSaleSetComponentSchema = z.object({
  componentProductId: z.string().uuid(),
  variantSegment: variantEnum,
  sizeLabel: z.string().min(1).max(32),
  quantityPerSet: z.coerce.number().int().min(1).max(999)
});

export const manualSaleLineSchema = z.object({
  productId: z.string().uuid(),
  /** Voor sets: variantSegment + sizeLabel zijn niet relevant; gebruik components. */
  isSet: z.boolean().optional().default(false),
  variantSegment: variantEnum.optional(),
  sizeLabel: z.string().max(32).optional(),
  quantity: z.coerce.number().int().min(1).max(999999),
  /** Aanbevolen omzet incl. btw per stuk (set: setprijs; regulier: prijs van gekozen variant). */
  unitRevenueInclCents: z.coerce.number().int().min(0).default(0),
  components: z.array(manualSaleSetComponentSchema).max(20).optional()
});

export const createManualSaleSchema = z.object({
  saleDate: z.string().min(1).max(32), // YYYY-MM-DD
  note: z.string().max(2000).optional().default(""),
  lines: z.array(manualSaleLineSchema).min(1).max(500)
});

export type CreateManualSaleInput = z.infer<typeof createManualSaleSchema>;
export type ManualSaleSetComponentInput = z.infer<typeof manualSaleSetComponentSchema>;

