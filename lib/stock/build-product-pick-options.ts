import type { ProductPickOption } from "@/lib/stock/product-pick-types";
import { normalizeVariantBlock } from "@/lib/shop/product-json";

export function buildProductPickOptions(
  rows: {
    id: string;
    name: string;
    printing_excl_cents?: unknown;
    variant_youth: unknown;
    variant_adult: unknown;
    variant_socks?: unknown;
    variant_shoes?: unknown;
    variant_onesize?: unknown;
  }[]
): ProductPickOption[] {
  return rows.map((p) => {
    const y = normalizeVariantBlock(p.variant_youth);
    const a = normalizeVariantBlock(p.variant_adult);
    const s = normalizeVariantBlock(p.variant_socks);
    const h = normalizeVariantBlock(p.variant_shoes);
    const o = normalizeVariantBlock(p.variant_onesize);
    const printing =
      typeof p.printing_excl_cents === "number" && Number.isFinite(p.printing_excl_cents) && p.printing_excl_cents >= 0
        ? p.printing_excl_cents
        : 0;
    return {
      id: p.id,
      name: p.name,
      printingExclCents: printing,
      youth: {
        modelNumber: String(y.model_number ?? "").trim(),
        sizes: [...new Set(y.sizes ?? [])]
      },
      adult: {
        modelNumber: String(a.model_number ?? "").trim(),
        sizes: [...new Set(a.sizes ?? [])]
      },
      socks: {
        modelNumber: String(s.model_number ?? "").trim(),
        sizes: [...new Set(s.sizes ?? [])]
      },
      shoes: {
        modelNumber: String(h.model_number ?? "").trim(),
        sizes: [...new Set(h.sizes ?? [])]
      },
      onesize: {
        modelNumber: String(o.model_number ?? "").trim(),
        sizes: [...new Set(o.sizes ?? [])]
      }
    };
  });
}
