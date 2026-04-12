/**
 * Same-origin URL naar de proxy in `app/api/storage-public/[...path]/route.ts`.
 * Voorkomt net::ERR_BLOCKED_BY_ORB in Chrome bij cross-origin Storage-URLs + strikte/niet-afbeelding responses.
 */
export function getPublicProductImageUrl(path: string | null | undefined): string | null {
  if (!path || !String(path).trim()) return null;
  const clean = String(path).trim();
  if (clean.includes("..") || clean.startsWith("/")) return null;
  const segments = clean
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s));
  if (segments.length === 0) return null;
  return `/api/storage-public/${segments.join("/")}`;
}
