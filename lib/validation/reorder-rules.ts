import { z } from "zod";

export const reorderRuleRowSchema = z.object({
  variantSegment: z.enum(["youth", "adult", "socks", "shoes", "onesize"]),
  sizeLabel: z.string().min(1).max(32),
  isActive: z.boolean(),
  thresholdQty: z.coerce.number().int().min(0).max(999999),
  targetQty: z.coerce.number().int().min(0).max(999999)
});

export const upsertReorderRulesSchema = z.object({
  productId: z.string().uuid(),
  rules: z.array(reorderRuleRowSchema).max(500)
});

export type UpsertReorderRulesInput = z.infer<typeof upsertReorderRulesSchema>;

