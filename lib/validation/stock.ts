import { z } from "zod";

export const createBatchSchema = z.object({
  productId: z.string().uuid(),
  receivedAt: z.string().optional(),
  quantityReceived: z.coerce.number().int().min(0),
  note: z.string().max(500).optional().nullable()
});

export const consumeStockSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1),
    reason: z.string().max(80).optional().default("sale"),
    /** youth | adult | weglaten; formulier stuurt `legacy` voor oude batches zonder label */
    variantMode: z.enum(["youth", "adult", "legacy"]).optional(),
    sizeLabel: z.string().max(80).optional().nullable()
  })
  .superRefine((data, ctx) => {
    if (data.variantMode === "legacy") return;
    if (data.variantMode === "youth" || data.variantMode === "adult") {
      const s = data.sizeLabel != null ? String(data.sizeLabel).trim() : "";
      if (!s) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sizeLabel"], message: "Maat vereist" });
      }
    }
  });

