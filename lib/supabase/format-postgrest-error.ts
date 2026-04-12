/** Volledige PostgREST/Postgres-context voor redirects en logs (message alleen is vaak te kort). */
export function formatPostgrestError(err: {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}): string {
  const parts = [err.message.trim()];
  if (err.details && String(err.details).trim()) parts.push(String(err.details).trim());
  if (err.hint && String(err.hint).trim()) parts.push(`Hint: ${String(err.hint).trim()}`);
  if (err.code && String(err.code).trim()) parts.push(`[${String(err.code).trim()}]`);
  return parts.join(" — ");
}
