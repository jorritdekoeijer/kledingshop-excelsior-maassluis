import { z } from "zod";

export const stockDeliveryLineSchema = z.object({
  productId: z.string().uuid(),
  variantSegment: z.enum(["youth", "adult"]),
  quantity: z.coerce.number().int().min(1).max(999999),
  sizeLabel: z.string().min(1).max(32),
  /** Basis-inkoopprijs per stuk (excl. btw) zoals op de factuur. */
  unitPurchaseExclCents: z.coerce.number().int().min(0),
  /** Bedrukkingsdeel per stuk (excl. btw). Wordt NIET meegeteld in factuurcontrole, wel in kostprijs. */
  unitPrintingExclCents: z.coerce.number().int().min(0).default(0)
});

export const createStockDeliverySchema = z.object({
  invoiceDate: z.string().max(32).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  invoiceNumber: z.string().max(120).optional().nullable(),
  /** Optioneel: factuurbedrag incl. btw (centen) ter controle tegen de som van de regels */
  invoiceTotalInclCents: z.coerce.number().int().min(0).optional().nullable(),
  lines: z.array(stockDeliveryLineSchema).min(1).max(200)
});

export type CreateStockDeliveryInput = z.infer<typeof createStockDeliverySchema>;
