import { normalizeVariantBlock } from "@/lib/shop/product-json";

export function lineSizeAllowed(
  variant: "youth" | "adult" | "socks" | "shoes" | "onesize" | undefined,
  size: string | undefined,
  variantYouth: unknown,
  variantAdult: unknown,
  variantSocks: unknown,
  variantShoes: unknown,
  variantOneSize: unknown
): boolean {
  if (!variant) return true;
  const block =
    variant === "youth"
      ? normalizeVariantBlock(variantYouth)
      : variant === "adult"
        ? normalizeVariantBlock(variantAdult)
        : variant === "socks"
          ? normalizeVariantBlock(variantSocks)
          : variant === "shoes"
            ? normalizeVariantBlock(variantShoes)
            : normalizeVariantBlock(variantOneSize);
  const sizes = block.sizes ?? [];
  if (sizes.length === 0) return true;
  if (!size || !sizes.includes(size)) return false;
  return true;
}
