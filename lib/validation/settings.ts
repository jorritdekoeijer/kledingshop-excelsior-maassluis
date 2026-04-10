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
  dayOfMonth: z.coerce.number().int().min(1).max(28)
});

