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

/** Paden voor galerij: primair eerst, daarna sort_order. */
export function orderedImagePaths(images: ProductImageRow[] | null | undefined): string[] {
  if (!images?.length) return [];
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return sorted.map((i) => i.path).filter((p): p is string => Boolean(p && String(p).trim()));
}
