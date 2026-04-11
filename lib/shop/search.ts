/**
 * Zoekterm uit query: trim, max lengte.
 * Verwijdert tekens die ILIKE / PostgREST `.or()` kunnen breken (% _ ,).
 */
export function normalizeSearchQuery(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw
    .trim()
    .replace(/[%_,]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return t.length > 0 ? t : undefined;
}
