import type { z } from "zod";
import { canonicalPriceCentsFromVariants } from "@/lib/products/variant-pricing";
import { productUpsertSchema, productVariantBlockSchema } from "@/lib/validation/products";
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

  const rawDetails = parseJsonField<unknown>(formData.get("productDetailsJson"), []);
  const productDetails = Array.isArray(rawDetails)
    ? rawDetails.filter((row: { label?: string }) => row && String(row.label ?? "").trim().length > 0)
    : [];

  const variantYouthRaw = parseJsonField<unknown>(formData.get("variantYouthJson"), {});
  const variantAdultRaw = parseJsonField<unknown>(formData.get("variantAdultJson"), {});
  const variantSocksRaw = parseJsonField<unknown>(formData.get("variantSocksJson"), {});
  const variantShoesRaw = parseJsonField<unknown>(formData.get("variantShoesJson"), {});
  const variantOneSizeRaw = parseJsonField<unknown>(formData.get("variantOneSizeJson"), {});

  const youthZ = productVariantBlockSchema.safeParse(variantYouthRaw);
  if (!youthZ.success) {
    return { ok: false, message: youthZ.error.issues[0]?.message ?? "Ongeldige jeugd-variant." };
  }
  const adultZ = productVariantBlockSchema.safeParse(variantAdultRaw);
  if (!adultZ.success) {
    return { ok: false, message: adultZ.error.issues[0]?.message ?? "Ongeldige volwassen-variant." };
  }
  const socksZ = productVariantBlockSchema.safeParse(variantSocksRaw);
  if (!socksZ.success) {
    return { ok: false, message: socksZ.error.issues[0]?.message ?? "Ongeldige sokken-variant." };
  }
  const shoesZ = productVariantBlockSchema.safeParse(variantShoesRaw);
  if (!shoesZ.success) {
    return { ok: false, message: shoesZ.error.issues[0]?.message ?? "Ongeldige schoenen-variant." };
  }
  const oneZ = productVariantBlockSchema.safeParse(variantOneSizeRaw);
  if (!oneZ.success) {
    return { ok: false, message: oneZ.error.issues[0]?.message ?? "Ongeldige one size-variant." };
  }

  const variantYouth = youthZ.data;
  const variantAdult = adultZ.data;
  const variantSocks = socksZ.data;
  const variantShoes = shoesZ.data;
  const variantOneSize = oneZ.data;

  const garmentType = formData.get("garmentType");
  const priceCents =
    garmentType === "socks"
      ? (variantSocks.sale_cents != null ? variantSocks.sale_cents : null)
      : garmentType === "shoes"
        ? (variantShoes.sale_cents != null ? variantShoes.sale_cents : null)
        : garmentType === "onesize"
          ? (variantOneSize.sale_cents != null ? variantOneSize.sale_cents : null)
        : canonicalPriceCentsFromVariants(variantYouth, variantAdult);
  if (priceCents === null) {
    return {
      ok: false,
      message:
        garmentType === "socks"
          ? "Vul een verkoopprijs in bij Sokken (SOCKS), incl. btw."
          : garmentType === "shoes"
            ? "Vul een verkoopprijs in bij Schoenen (SHOES), incl. btw."
            : garmentType === "onesize"
              ? "Vul een verkoopprijs in bij One Size, incl. btw."
          : "Vul minstens één verkoopprijs in bij Jeugd (YOUTH) of Volwassenen (ADULT), incl. btw."
    };
  }

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
    priceCents,
    printingExclCents: formData.get("printingExclCents"),
    allowJerseyNumber: formData.get("allowJerseyNumber"),
    jerseyNumberSaleCents: formData.get("jerseyNumberSaleCents"),
    jerseyNumberPurchaseSingleExclCents: formData.get("jerseyNumberPurchaseSingleExclCents"),
    jerseyNumberPurchaseDoubleExclCents: formData.get("jerseyNumberPurchaseDoubleExclCents"),
    temporaryDiscountPercent,
    active: formData.get("active"),
    categoryId: cid,
    garmentType: formData.get("garmentType"),
    productDetails,
    variantYouth,
    variantAdult,
    variantSocks,
    variantShoes,
    variantOneSize
  });

  if (!zr.success) {
    return { ok: false, message: zr.error.issues[0]?.message ?? "Ongeldige invoer" };
  }
  return { ok: true, value: zr.data };
}
