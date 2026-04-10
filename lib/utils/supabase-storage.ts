function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getPublicProductImageUrl(path: string | null | undefined) {
  if (!path) return null;
  const base = getEnv("SUPABASE_URL").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/product-images/${encodeURIComponent(path)}`;
}

