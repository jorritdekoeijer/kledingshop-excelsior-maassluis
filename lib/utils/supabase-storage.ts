import { createClient } from "@supabase/supabase-js";

function getSupabaseUrlAndAnon(): { url: string; anon: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return { url: url.replace(/\/$/, ""), anon };
}

/** Fallback als env tijdens build ontbreekt: zelfde vorm als getPublicUrl. */
function manualPublicUrl(path: string): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) return null;
  const base = url.replace(/\/$/, "");
  const segments = path.split("/").filter(Boolean).map((s) => encodeURIComponent(s));
  return `${base}/storage/v1/object/public/product-images/${segments.join("/")}`;
}

/**
 * Publieke URL voor bestanden in bucket `product-images`.
 * Gebruikt de officiële Storage-helper waar mogelijk.
 */
export function getPublicProductImageUrl(path: string | null | undefined): string | null {
  if (!path || !String(path).trim()) return null;
  const clean = String(path).trim();
  const creds = getSupabaseUrlAndAnon();
  if (!creds) return manualPublicUrl(clean);
  try {
    const supabase = createClient(creds.url, creds.anon, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data } = supabase.storage.from("product-images").getPublicUrl(clean);
    return data.publicUrl;
  } catch {
    return manualPublicUrl(clean);
  }
}
