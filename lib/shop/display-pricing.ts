import { effectivePriceCents } from "@/lib/products/pricing";

export type ShopPriceRow = {
  price_cents: number;
  temporary_discount_percent?: number | null;
};

/** Prijsweergave en winkelwagen: effectieve prijs na tijdelijke korting. */
export function shopDisplayPricing(row: ShopPriceRow) {
  const pct = Number(row.temporary_discount_percent ?? 0);
  const originalCents = row.price_cents;
  const effectiveCents = effectivePriceCents(originalCents, pct);
  const showExtraDiscount = pct > 0 && effectiveCents < originalCents;
  return { effectiveCents, originalCents, showExtraDiscount };
}
