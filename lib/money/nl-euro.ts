const VAT_RATE = 0.21;

/** "42,30" of "42.30" → centen (afgerond). */
export function parseDutchEuroToCents(input: unknown): number {
  if (input === null || input === undefined) return 0;
  let s = String(input).trim().replace(/\s/g, "");
  if (!s) return 0;
  s = s.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return NaN as unknown as number;
  return Math.round(n * 100);
}

export function centsToEuroString(cents: number): string {
  const n = Number(cents ?? 0) / 100;
  if (!Number.isFinite(n)) return "0,00";
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

/** Prijs excl. btw uit incl. (21%). */
export function exclCentsFromIncl21(inclCents: number): number {
  return Math.round(inclCents / (1 + VAT_RATE));
}

/** Prijs incl. btw uit excl. (21%). */
export function inclCentsFromExcl21(exclCents: number): number {
  return Math.round(exclCents * (1 + VAT_RATE));
}
