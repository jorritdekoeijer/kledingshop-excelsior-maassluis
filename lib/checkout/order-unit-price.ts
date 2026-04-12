import { effectivePriceCents } from "@/lib/products/pricing";
import { normalizeVariantBlock } from "@/lib/shop/product-json";

/** Eenheidsprijs voor order/checkout: variant-specifieke verkoop of product-prijs. */
export function orderUnitPriceCentsFromProductRow(row: {
  price_cents: number;
  temporary_discount_percent: number | null;
  variant_youth: unknown;
  variant_adult: unknown;
  variant?: "youth" | "adult";
}): number {
  const pct = Number(row.temporary_discount_percent ?? 0);
  if (!row.variant) {
    return effectivePriceCents(row.price_cents, pct);
  }
  const block = normalizeVariantBlock(row.variant === "youth" ? row.variant_youth : row.variant_adult);
  const sale = block.sale_cents;
  if (sale != null && Number.isFinite(sale) && sale >= 0) {
    return effectivePriceCents(sale, pct);
  }
  return effectivePriceCents(row.price_cents, pct);
}
