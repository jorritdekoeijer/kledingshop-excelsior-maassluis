/**
 * Valideert een Supabase-projectbasis (https://…supabase.co).
 * JWT’s (anon/service role) beginnen met "eyJ" en mogen nooit als URL gebruikt worden.
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
