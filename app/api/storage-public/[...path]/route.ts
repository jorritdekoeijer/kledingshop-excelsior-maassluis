import { NextResponse } from "next/server";
import { parseSupabaseHttpsOrigin } from "@/lib/utils/supabase-project-url";

export const runtime = "nodejs";

const BUCKET = "product-images";

/**
 * Publieke Storage-URL: alleen `SUPABASE_URL` (https://…supabase.co).
 * `SUPABASE_SERVICE_ROLE_KEY` hoort nergens in de URL; publieke objecten vereisen geen Authorization-header.
 */
function supabasePublicObjectUrl(pathInBucket: string): string | null {
  const base = parseSupabaseHttpsOrigin(process.env.SUPABASE_URL);
  if (!base) return null;
  const segments = pathInBucket
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s));
  return `${base}/storage/v1/object/public/${BUCKET}/${segments.join("/")}`;
}

/**
 * Proxies public Storage objects via de eigen origin zodat de browser geen
 * cross-origin ORB (Opaque Response Blocking) op `<img>` hoeft te doorstaan.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  if (!path?.length) {
    return new NextResponse(null, { status: 404 });
  }
  const key = path.filter((p) => p !== ".." && p.length > 0).join("/");
  if (!key || key.includes("..")) {
    return new NextResponse(null, { status: 400 });
  }

  const url = supabasePublicObjectUrl(key);
  if (!url) {
    return new NextResponse(null, { status: 500 });
  }

  const res = await fetch(url, { next: { revalidate: 86_400 } });
  if (!res.ok) {
    return new NextResponse(null, { status: res.status === 404 ? 404 : 502 });
  }

  const ct = res.headers.get("content-type") ?? "application/octet-stream";
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=86400, s-maxage=86400"
    }
  });
}
