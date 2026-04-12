import { z } from "zod";

/** Lege string → null (voorkomt dat safeParse faalt en alles terugvalt naar defaults). */
const optionalStoragePath = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined || v === null) return null;
    const t = String(v).trim();
    return t.length === 0 ? null : t;
  });

const tileSchema = z.object({
  categoryId: z
    .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  imagePath: optionalStoragePath
});

/** Positie van de middelste gradientstop (0–100), voor `linear-gradient` (middenkleur). */
const gradientMidPercent = z.preprocess(
  (v) => {
    if (v === undefined || v === null || v === "") return 50;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    if (Number.isNaN(n)) return 50;
    return Math.min(100, Math.max(0, Math.round(n)));
  },
  z.number().int().min(0).max(100)
);

export const homepageSettingsSchema = z.object({
  bannerLine1: z.string().max(280).default(""),
  bannerLine2: z.string().max(280).default(""),
  bannerLine3: z.string().max(280).default(""),
  bannerEnabled1: z.boolean().default(true),
  bannerEnabled2: z.boolean().default(true),
  bannerEnabled3: z.boolean().default(true),
  logoPath: optionalStoragePath,
  heroBannerPath: optionalStoragePath,
  /** Meerdere regels mogelijk (whitespace-pre-line) */
  heroTitle: z.string().max(400).default(""),
  heroSubtitle: z.string().max(500).default(""),
  /** Middenstop van de hero-gradient (overlay op foto én fallback zonder foto). */
  heroGradientMidStopPercent: gradientMidPercent.default(50),
  /** Vier tegels onder de hero */
  tiles: z.array(tileSchema).length(4).default(() => [
    { imagePath: null, categoryId: null },
    { imagePath: null, categoryId: null },
    { imagePath: null, categoryId: null },
    { imagePath: null, categoryId: null }
  ])
});

export type HomepageSettings = z.infer<typeof homepageSettingsSchema>;

function normalizeTileEntry(t: unknown): Record<string, unknown> {
  if (typeof t !== "object" || t === null) return {};
  const o = t as Record<string, unknown>;
  return {
    categoryId: o.categoryId ?? o.category_id,
    imagePath: o.imagePath ?? o.image_path
  };
}

function normalizeTiles(rawTiles: unknown): unknown {
  if (!Array.isArray(rawTiles)) return rawTiles;
  const padded = [...rawTiles];
  while (padded.length < 4) padded.push({});
  return padded.slice(0, 4).map((t) => normalizeTileEntry(t));
}

function normalizeHomepageRaw(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    logoPath: raw.logoPath ?? raw.logo_path,
    heroBannerPath: raw.heroBannerPath ?? raw.hero_banner_path,
    heroTitle: raw.heroTitle ?? raw.hero_title,
    heroSubtitle: raw.heroSubtitle ?? raw.hero_subtitle,
    bannerLine1: raw.bannerLine1 ?? raw.banner_line1,
    bannerLine2: raw.bannerLine2 ?? raw.banner_line2,
    bannerLine3: raw.bannerLine3 ?? raw.banner_line3,
    bannerEnabled1: raw.bannerEnabled1 ?? raw.banner_enabled1,
    bannerEnabled2: raw.bannerEnabled2 ?? raw.banner_enabled2,
    bannerEnabled3: raw.bannerEnabled3 ?? raw.banner_enabled3,
    heroGradientMidStopPercent: raw.heroGradientMidStopPercent ?? raw.hero_gradient_mid_stop_percent,
    tiles: normalizeTiles(raw.tiles)
  };
}

export function parseHomepageSettings(raw: unknown): HomepageSettings {
  const base =
    typeof raw === "object" && raw !== null ? normalizeHomepageRaw(raw as Record<string, unknown>) : {};
  const parsed = homepageSettingsSchema.safeParse(base);
  if (parsed.success) return parsed.data;

  const loose = homepageSettingsSchema.safeParse({
    ...homepageSettingsSchema.parse({}),
    logoPath: typeof base.logoPath === "string" ? base.logoPath : null,
    heroBannerPath: typeof base.heroBannerPath === "string" ? base.heroBannerPath : null,
    heroTitle: typeof base.heroTitle === "string" ? base.heroTitle : "",
    heroSubtitle: typeof base.heroSubtitle === "string" ? base.heroSubtitle : "",
    bannerLine1: typeof base.bannerLine1 === "string" ? base.bannerLine1 : "",
    bannerLine2: typeof base.bannerLine2 === "string" ? base.bannerLine2 : "",
    bannerLine3: typeof base.bannerLine3 === "string" ? base.bannerLine3 : "",
    heroGradientMidStopPercent:
      typeof base.heroGradientMidStopPercent === "number"
        ? base.heroGradientMidStopPercent
        : undefined
  });
  if (loose.success) return loose.data;
  return homepageSettingsSchema.parse({});
}
