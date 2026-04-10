import { z } from "zod";

export const categoryUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80)
});

export const productUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  description: z.string().max(5000).optional().nullable(),
  priceCents: z.coerce.number().int().min(0),
  active: z.coerce.boolean().default(true),
  categoryId: z.string().uuid().optional().nullable(),
  costGroupId: z.string().uuid().optional().nullable()
});

