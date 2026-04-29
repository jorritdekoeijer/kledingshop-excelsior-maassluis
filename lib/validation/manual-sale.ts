import { z } from "zod";

export const manualSaleLineSchema = z.object({
  productId: z.string().uuid(),
  variantSegment: z.enum(["youth", "adult", "socks", "shoes", "onesize"]),
  quantity: z.coerce.number().int().min(1).max(999999),
  sizeLabel: z.string().min(1).max(32)
});

export const createManualSaleSchema = z.object({
  saleDate: z.string().min(1).max(32), // YYYY-MM-DD
  note: z.string().max(2000).optional().default(""),
  lines: z.array(manualSaleLineSchema).min(1).max(500)
});

export type CreateManualSaleInput = z.infer<typeof createManualSaleSchema>;

