import type { ProductDetailRow, ProductVariantBlock } from "@/lib/validation/products";

export function normalizeProductDetails(raw: unknown): ProductDetailRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ProductDetailRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as { label?: unknown; value?: unknown };
    const label = String(o.label ?? "").trim();
    const value = String(o.value ?? "").trim();
    if (!label) continue;
    out.push({ label, value });
  }
  return out;
}

export function normalizeVariantBlock(raw: unknown): ProductVariantBlock {
  if (!raw || typeof raw !== "object") {
    return { purchase_cents: null, sale_cents: null, model_number: "", sizes: [] };
  }
  const o = raw as Record<string, unknown>;
  const pc = o.purchase_cents;
  const sc = o.sale_cents;
  return {
    purchase_cents: typeof pc === "number" && Number.isFinite(pc) ? pc : null,
    sale_cents: typeof sc === "number" && Number.isFinite(sc) ? sc : null,
    model_number: String(o.model_number ?? ""),
    sizes: Array.isArray(o.sizes) ? o.sizes.map((s) => String(s)) : []
  };
}
