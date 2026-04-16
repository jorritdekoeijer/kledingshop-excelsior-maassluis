import { z } from "zod";

export const supplierOrderLineSchema = z.object({
  productId: z.string().uuid(),
  variantSegment: z.enum(["youth", "adult", "socks", "shoes"]),
  sizeLabel: z.string().min(1).max(32),
  quantity: z.coerce.number().int().min(1).max(999999)
});

export const createSupplierOrderSchema = z.object({
  orderDate: z.string().min(1).max(32),
  supplierId: z.string().uuid(),
  note: z.string().max(2000).optional().nullable(),
  lines: z.array(supplierOrderLineSchema).min(1).max(500)
});

export type CreateSupplierOrderInput = z.infer<typeof createSupplierOrderSchema>;

