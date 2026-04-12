/** Effectieve verkoopprijs (incl. btw) na tijdelijke korting op de incl.-prijs. */
export function effectivePriceCents(priceInclCents: number, discountPercent: number): number {
  const d = Math.min(100, Math.max(0, discountPercent));
  return Math.round(priceInclCents * (1 - d / 100));
}
