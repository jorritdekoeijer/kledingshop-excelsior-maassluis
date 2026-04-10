import { z } from "zod";

export const createBatchSchema = z.object({
  productId: z.string().uuid(),
  receivedAt: z.string().optional(),
  quantityReceived: z.coerce.number().int().min(0),
  note: z.string().max(500).optional().nullable()
});

export const consumeStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  reason: z.string().max(80).optional().default("sale")
});

