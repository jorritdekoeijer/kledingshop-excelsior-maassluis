import { z } from "zod";

export const smtpSettingsSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.coerce.boolean().default(false),
  user: z.string().min(1),
  pass: z.string().min(1),
  from: z.string().email()
});

export const mollieSettingsSchema = z.object({
  apiKey: z.string().min(1),
  webhookSecret: z.string().min(1)
});

export const monthlyEmailSettingsSchema = z.object({
  dayOfMonth: z.coerce.number().int().min(1).max(28),
  enabled: z.coerce.boolean().default(true),
  /** Ontvanger van de maandelijkse samenvatting (commissie). */
  recipientEmail: z.union([z.string().email(), z.literal("")]).optional(),
  /** YYYY-MM van het laatst verwerkte rapport (idempotentie cron). */
  lastCompletedReportPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

