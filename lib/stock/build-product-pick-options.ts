import type { ProductPickOption } from "@/lib/stock/product-pick-types";
import { normalizeVariantBlock } from "@/lib/shop/product-json";

export function buildProductPickOptions(
  rows: { id: string; name: string; variant_youth: unknown; variant_adult: unknown }[]
): ProductPickOption[] {
  return rows.map((p) => {
    const y = normalizeVariantBlock(p.variant_youth);
    const a = normalizeVariantBlock(p.variant_adult);
    return {
      id: p.id,
      name: p.name,
      youth: {
        modelNumber: String(y.model_number ?? "").trim(),
        sizes: [...new Set(y.sizes ?? [])]
      },
      adult: {
        modelNumber: String(a.model_number ?? "").trim(),
        sizes: [...new Set(a.sizes ?? [])]
      }
    };
  });
}
