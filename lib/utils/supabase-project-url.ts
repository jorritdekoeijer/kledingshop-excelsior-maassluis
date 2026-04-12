/**
 * Bepaalt de Supabase-project-URL (https://…supabase.co).
 * JWT’s (anon/service role) beginnen met "eyJ" en worden nooit als URL gebruikt.
 * Als NEXT_PUBLIC_SUPABASE_URL per ongeluk een key is, vallen we terug op SUPABASE_URL.
 */
export function parseSupabaseHttpsOrigin(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (t.startsWith("eyJ")) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function resolveSupabaseProjectUrl(): string | null {
  const candidates = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL];
  for (const c of candidates) {
    const ok = parseSupabaseHttpsOrigin(c);
    if (ok) return ok;
  }
  return null;
}
