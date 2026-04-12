import type { ProductVariantBlock } from "@/lib/validation/products";

/** Kleinste verkoopprijs incl. btw (centen) voor overzicht/winkelwagen; minstens één variant moet een verkoopprijs hebben. */
export function canonicalPriceCentsFromVariants(
  youth: ProductVariantBlock,
  adult: ProductVariantBlock
): number | null {
  const y = youth.sale_cents;
  const a = adult.sale_cents;
  const vals: number[] = [];
  if (y != null && Number.isFinite(y) && y >= 0) vals.push(y);
  if (a != null && Number.isFinite(a) && a >= 0) vals.push(a);
  if (vals.length === 0) return null;
  return Math.min(...vals);
}
