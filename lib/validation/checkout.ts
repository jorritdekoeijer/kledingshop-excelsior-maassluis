import { z } from "zod";

const variantEnum = z.enum(["youth", "adult", "socks", "shoes", "onesize"]);

const checkoutSetComponentSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  variant: variantEnum.optional(),
  size: z.string().max(32).optional()
});

const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  variant: variantEnum.optional(),
  size: z.string().max(32).optional(),
  jerseyNumber: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Rugnummer moet uit cijfers bestaan.")
    .optional(),
  isSet: z.boolean().optional(),
  setComponents: z.array(checkoutSetComponentSchema).max(20).optional()
});

export const checkoutRequestSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(50),
  guestEmail: z.string().email(),
  guestName: z.string().min(1).max(200).trim(),
  guestPhone: z.string().max(40).optional(),
  shippingAddress: z.object({
    line1: z.string().min(1).max(200).trim(),
    line2: z.string().max(200).trim().optional(),
    postalCode: z.string().min(1).max(20).trim(),
    city: z.string().min(1).max(100).trim(),
    country: z.string().length(2).default("NL")
  })
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutSetComponent = z.infer<typeof checkoutSetComponentSchema>;
