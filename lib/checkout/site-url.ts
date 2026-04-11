/** Basis-URL voor Mollie redirect/webhook (geen trailing slash). */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.endsWith("/") ? explicit.slice(0, -1) : explicit;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const base = vercel.startsWith("http") ? vercel : `https://${vercel}`;
    return base.endsWith("/") ? base.slice(0, -1) : base;
  }
  return "http://localhost:3000";
}
