export type ProductImageRow = {
  path: string;
  is_primary: boolean | null;
  sort_order: number | null;
};

export function pickPrimaryImagePath(images: ProductImageRow[] | null | undefined) {
  if (!images?.length) return null;
  const primary = images.find((i) => i.is_primary);
  if (primary) return primary.path;
  return [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.path ?? null;
}
