import { NextResponse } from "next/server";
import { getAmsterdamYmd, previousCalendarYearMonth, utcMonthRangeIso } from "@/lib/datetime/amsterdam";
import { sendMonthlyDigestEmail } from "@/lib/email/send-monthly-digest";
import { fetchMonthlyOrderStats } from "@/lib/reports/monthly-order-stats";
import { getSettingService, upsertSettingService } from "@/lib/settings-service";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { monthlyEmailSettingsSchema } from "@/lib/validation/settings";

export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function reportLabelNl(isoYm: string): string {
  const [ys, ms] = isoYm.split("-").map(Number);
  return new Date(Date.UTC(ys, ms - 1, 15)).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

export async function GET(request: Request) {
  let expected: string;
  try {
    expected = getEnv("CRON_SECRET");
  } catch {
    return NextResponse.json({ ok: false, error: "CRON_SECRET ontbreekt" }, { status: 503 });
  }

  const got = request.headers.get("x-cron-secret") ?? "";
  if (got !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const rawUnknown = await getSettingService("monthly_email");
  const raw = rawUnknown as Record<string, unknown>;

  const parsed = monthlyEmailSettingsSchema.safeParse({
    dayOfMonth: raw.dayOfMonth ?? 5,
    enabled: raw.enabled ?? true,
    recipientEmail: typeof raw.recipientEmail === "string" ? raw.recipientEmail : "",
    lastCompletedReportPeriod: typeof raw.lastCompletedReportPeriod === "string" ? raw.lastCompletedReportPeriod : undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "monthly_email settings ongeldig" }, { status: 503 });
  }

  const cfg = parsed.data;

  if (!cfg.enabled) {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  const now = new Date();
  const { y, m, d } = getAmsterdamYmd(now);

  if (d !== cfg.dayOfMonth) {
    return NextResponse.json({
      ok: true,
      skipped: "wrong_day",
      amsterdamDay: d,
      configuredDay: cfg.dayOfMonth
    });
  }

  const reportYm = previousCalendarYearMonth(y, m);

  if (cfg.lastCompletedReportPeriod === reportYm) {
    return NextResponse.json({ ok: true, skipped: "already_sent", reportYm });
  }

  const to = (cfg.recipientEmail && cfg.recipientEmail.trim()) || process.env.MONTHLY_DIGEST_EMAIL?.trim();
  if (!to) {
    return NextResponse.json({ ok: false, error: "Geen ontvanger (instellingen of MONTHLY_DIGEST_EMAIL)" }, { status: 503 });
  }

  let range: { start: string; end: string };
  try {
    range = utcMonthRangeIso(reportYm);
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige rapportperiode" }, { status: 500 });
  }

  const svc = createSupabaseServiceClient();
  let stats: Awaited<ReturnType<typeof fetchMonthlyOrderStats>>;
  try {
    stats = await fetchMonthlyOrderStats(svc, range.start, range.end);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "stats failed" }, { status: 500 });
  }

  const label = reportLabelNl(reportYm);
  const sent = await sendMonthlyDigestEmail({
    to,
    reportLabel: label,
    orderCount: stats.orderCount,
    revenueCents: stats.revenueCents
  });

  if (!sent) {
    return NextResponse.json({ ok: false, error: "SMTP mislukt of niet geconfigureerd" }, { status: 502 });
  }

  await upsertSettingService("monthly_email", {
    dayOfMonth: cfg.dayOfMonth,
    enabled: cfg.enabled,
    recipientEmail: cfg.recipientEmail ?? "",
    lastCompletedReportPeriod: reportYm
  });

  return NextResponse.json({
    ok: true,
    reportYm,
    orderCount: stats.orderCount,
    revenueCents: stats.revenueCents
  });
}
