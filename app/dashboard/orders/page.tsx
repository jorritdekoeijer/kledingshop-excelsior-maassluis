import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";

export default async function DashboardOrdersPage() {
  const gate = await requirePermission(permissions.orders.read);
  if (!gate.ok) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Geen toegang</h1>
        <p className="mt-2 text-sm text-zinc-600">Je hebt geen permissie om bestellingen te bekijken.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Orders</h1>
      <p className="mt-2 text-sm text-zinc-600">Hier komt straks orderbeheer + Mollie betalingen.</p>
    </div>
  );
}

