/** Kalenderdatum in Europe/Amsterdam (voor cron / rapportage). */

export function getAmsterdamYmd(d: Date): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
  const [y, m, day] = s.split("-").map((x) => Number(x));
  return { y, m, d: day };
}

/** Vorige kalendermaand t.o.v. een Amsterdam-datum. */
export function previousCalendarYearMonth(y: number, m: number): string {
  let ry = y;
  let rm = m - 1;
  if (rm < 1) {
    rm = 12;
    ry -= 1;
  }
  return `${ry}-${String(rm).padStart(2, "0")}`;
}

/** UTC-range [start, end) voor een YYYY-MM (statistieken in DB). */
export function utcMonthRangeIso(isoYm: string): { start: string; end: string } {
  const [ys, ms] = isoYm.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error(`Invalid YYYY-MM: ${isoYm}`);
  }
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}
