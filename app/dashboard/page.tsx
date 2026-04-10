import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";

export default async function DashboardHome() {
  const gate = await requirePermission(permissions.dashboard.access);
  if (!gate.ok) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Geen toegang</h1>
        <p className="mt-2 text-sm text-zinc-600">Je hebt geen permissie voor het dashboard.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-600">Je bent ingelogd en hebt dashboard-toegang.</p>
    </div>
  );
}

