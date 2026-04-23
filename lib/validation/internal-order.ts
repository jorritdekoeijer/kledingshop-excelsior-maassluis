import { z } from "zod";

export const internalOrderLineSchema = z.object({
  productId: z.string().uuid(),
  variantSegment: z.enum(["youth", "adult", "socks", "shoes", "onesize"]),
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

export const updateInternalOrderMetaSchema = z.object({
  id: z.string().uuid(),
  orderDate: z.string().min(1).max(32),
  costGroupId: z.string().uuid(),
  note: z.string().min(3).max(2000)
});

export type UpdateInternalOrderMetaInput = z.infer<typeof updateInternalOrderMetaSchema>;

export const updateInternalOrderRebookSchema = updateInternalOrderMetaSchema.extend({
  lines: z.array(internalOrderLineSchema).min(1).max(200)
});

export type UpdateInternalOrderRebookInput = z.infer<typeof updateInternalOrderRebookSchema>;

export const cancelInternalOrderSchema = z.object({
  id: z.string().uuid(),
  cancelNote: z.string().max(2000).optional()
});

export type CancelInternalOrderInput = z.infer<typeof cancelInternalOrderSchema>;

export const restoreInternalOrderStockSchema = z.object({
  id: z.string().uuid()
});

export type RestoreInternalOrderStockInput = z.infer<typeof restoreInternalOrderStockSchema>;

