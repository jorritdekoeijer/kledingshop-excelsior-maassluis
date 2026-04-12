import type { z } from "zod";
import { parseDutchEuroToCents } from "@/lib/money/nl-euro";
import { productUpsertSchema } from "@/lib/validation/products";
import { slugify } from "@/lib/utils/slugify";

export type ProductUpsertParsed = z.infer<typeof productUpsertSchema>;

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type ProductFormParseResult =
  | { ok: true; value: ProductUpsertParsed }
  | { ok: false; message: string };

export function parseProductUpsertFormData(formData: FormData): ProductFormParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = slugify(rawSlug) || slugify(name);
  if (!slug) {
    return { ok: false, message: "Vul een productnaam in." };
  }

  const priceIncl = parseDutchEuroToCents(formData.get("priceInclEur"));
  if (Number.isNaN(priceIncl)) {
    return {
      ok: false,
      message: "Ongeldige prijs. Gebruik een bedrag zoals 42,30 (euro’s incl. btw)."
    };
  }

  const rawDetails = parseJsonField<unknown>(formData.get("productDetailsJson"), []);
  const productDetails = Array.isArray(rawDetails)
    ? rawDetails.filter((row: { label?: string }) => row && String(row.label ?? "").trim().length > 0)
    : [];

  const variantYouth = parseJsonField<unknown>(formData.get("variantYouthJson"), {});
  const variantAdult = parseJsonField<unknown>(formData.get("variantAdultJson"), {});

  const discountRaw = formData.get("discountPercent");
  const temporaryDiscountPercent =
    discountRaw === null || discountRaw === "" ? 0 : Number(discountRaw);
  if (!Number.isFinite(temporaryDiscountPercent)) {
    return { ok: false, message: "Ongeldige korting." };
  }

  const cid = String(formData.get("categoryId") ?? "").trim();

  const zr = productUpsertSchema.safeParse({
    name,
    slug,
    description: String(formData.get("description") ?? "").trim() || null,
    priceCents: priceIncl,
    temporaryDiscountPercent,
    active: formData.get("active"),
    categoryId: cid.length ? cid : null,
    productDetails,
    variantYouth,
    variantAdult
  });

  if (!zr.success) {
    return { ok: false, message: zr.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  return { ok: true, value: zr.data };
}
