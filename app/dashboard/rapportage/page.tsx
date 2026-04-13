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
  const report = await fetchFinancialOverview(supabase, period);

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

      <FinancialReportView report={report} />
    </div>
  );
}
