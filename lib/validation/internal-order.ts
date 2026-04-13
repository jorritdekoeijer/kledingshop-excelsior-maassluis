import { z } from "zod";

export const internalOrderLineSchema = z.object({
  productId: z.string().uuid(),
  variantSegment: z.enum(["youth", "adult"]),
  quantity: z.coerce.number().int().min(1).max(999999),
  sizeLabel: z.string().min(1).max(32)
});

export const createInternalOrderSchema = z.object({
  orderDate: z.string().min(1).max(32),
  costGroupId: z.string().uuid(),
  note: z.string().min(3).max(2000),
  lines: z.array(internalOrderLineSchema).min(1).max(200)
});

export type CreateInternalOrderInput = z.infer<typeof createInternalOrderSchema>;

