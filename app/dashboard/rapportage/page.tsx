import { redirect } from "next/navigation";
import { FinancialReportView } from "@/components/dashboard/financial-report/FinancialReportView";
import { hasFinancialReportAccess } from "@/lib/auth/reporting-access";
import { getIsAdmin, getUserPermissions, requireLogin } from "@/lib/auth/permissions-server";
import { fetchFinancialOverview, resolveReportPeriod } from "@/lib/reports/financial-overview";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RapportagePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireLogin();
  const perms = await getUserPermissions(user.id);
  const isAdmin = await getIsAdmin();
  if (!hasFinancialReportAccess(perms, { isAdmin })) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  const period = resolveReportPeriod(from, to);

  const supabase = await createSupabaseServerClient();
  let report: Awaited<ReturnType<typeof fetchFinancialOverview>> | null = null;
  let loadError = "";
  try {
    report = await fetchFinancialOverview(supabase, period);
  } catch (e) {
    if (e instanceof Error) {
      loadError = e.message;
    } else if (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string") {
      const anyE = e as any;
      const extra = [
        anyE.code ? `code=${String(anyE.code)}` : null,
        anyE.details ? `details=${String(anyE.details)}` : null,
        anyE.hint ? `hint=${String(anyE.hint)}` : null
      ]
        .filter(Boolean)
        .join(" · ");
      loadError = extra ? `${anyE.message} (${extra})` : anyE.message;
    } else {
      try {
        loadError = JSON.stringify(e);
      } catch {
        loadError = String(e);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-blue">Financiële rapportage</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Overzicht van kostengroepen, webshopmarge en voorraadwaarde tegen inkoopprijs.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Periode: {period.fromDate} — {period.toDate}
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">Rapportage kon niet laden.</p>
          <p className="mt-1 text-red-700">
            Controleer of je database-migraties zijn uitgevoerd en of je gebruiker rechten heeft (bijv.{" "}
            <span className="font-mono text-xs">reporting:read</span> /{" "}
            <span className="font-mono text-xs">dashboard:access</span>).
          </p>
          <p className="mt-2 font-mono text-xs text-red-700/90">{loadError}</p>
        </div>
      ) : report ? (
        <FinancialReportView report={report} />
      ) : null}
    </div>
  );
}
