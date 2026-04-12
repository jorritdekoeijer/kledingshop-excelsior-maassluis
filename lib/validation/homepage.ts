import { z } from "zod";

const tileSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  imagePath: z.string().min(1).nullable().optional()
});

export const homepageSettingsSchema = z.object({
  bannerLine1: z.string().max(280).default(""),
  bannerLine2: z.string().max(280).default(""),
  bannerLine3: z.string().max(280).default(""),
  bannerEnabled1: z.boolean().default(true),
  bannerEnabled2: z.boolean().default(true),
  bannerEnabled3: z.boolean().default(true),
  logoPath: z.string().nullable().optional(),
  heroBannerPath: z.string().nullable().optional(),
  /** Meerdere regels mogelijk (whitespace-pre-line) */
  heroTitle: z.string().max(400).default(""),
  heroSubtitle: z.string().max(500).default(""),
  /** Vier tegels onder de hero */
  tiles: z.array(tileSchema).length(4).default([
    {},
    {},
    {},
    {}
  ])
});

export type HomepageSettings = z.infer<typeof homepageSettingsSchema>;

export function parseHomepageSettings(raw: unknown): HomepageSettings {
  const base = typeof raw === "object" && raw !== null ? raw : {};
  const parsed = homepageSettingsSchema.safeParse(base);
  if (parsed.success) return parsed.data;
  return homepageSettingsSchema.parse({});
}
