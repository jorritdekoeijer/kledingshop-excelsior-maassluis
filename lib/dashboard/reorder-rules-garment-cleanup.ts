import { ADULT_SIZE_OPTIONS, SHOES_SIZE_OPTIONS, SOCKS_SIZE_OPTIONS, YOUTH_SIZE_OPTIONS } from "@/lib/products/variant-constants";
import type { GarmentType } from "@/lib/validation/products";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/** Verwijdert voorraadregels die niet meer in de maatlijst voor deze kledingsoort passen. */
export async function deleteReorderRulesNotInGarmentTemplates(
  service: ServiceClient,
  productId: string,
  garmentType: GarmentType
) {
  const youthTpl =
    garmentType === "socks" ? SOCKS_SIZE_OPTIONS : garmentType === "shoes" ? SHOES_SIZE_OPTIONS : YOUTH_SIZE_OPTIONS;
  const adultTpl =
    garmentType === "socks" ? SOCKS_SIZE_OPTIONS : garmentType === "shoes" ? SHOES_SIZE_OPTIONS : ADULT_SIZE_OPTIONS;

  const { data: rules } = await service
    .from("stock_reorder_rules")
    .select("variant_segment,size_label")
    .eq("product_id", productId);

  for (const r of rules ?? []) {
    const tpl: readonly string[] =
      r.variant_segment === "youth"
        ? youthTpl
        : r.variant_segment === "adult"
          ? adultTpl
          : r.variant_segment === "socks"
            ? SOCKS_SIZE_OPTIONS
            : SHOES_SIZE_OPTIONS;
    if (!tpl.includes(String(r.size_label))) {
      await service
        .from("stock_reorder_rules")
        .delete()
        .eq("product_id", productId)
        .eq("variant_segment", r.variant_segment)
        .eq("size_label", r.size_label);
    }
  }
}
