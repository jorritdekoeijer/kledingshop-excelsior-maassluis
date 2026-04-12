function getSupabaseProjectUrl(): string {
  const v = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  return v.replace(/\/$/, "");
}

/**
 * Publieke URL naar een object in bucket `product-images`.
 * Pad met mappen (bijv. homepage/logo/uuid.png): encode per segment, niet het hele pad als één string
 * (anders worden slashes naar %2F en sommige CDN’s leveren het bestand niet).
 */
export function getPublicProductImageUrl(path: string | null | undefined) {
  if (!path || !path.trim()) return null;
  const base = getSupabaseProjectUrl();
  const encoded = path
    .split("/")
    .filter((s) => s.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/product-images/${encoded}`;
}

