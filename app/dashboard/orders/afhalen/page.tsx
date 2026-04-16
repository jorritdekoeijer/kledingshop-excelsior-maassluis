import Link from "next/link";
import { hasPermission, permissions } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

const statusNl: Record<string, string> = {
  ready_for_pickup: "Klaar om af te halen"
};

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function OrdersPickupDashboardPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const flashError = typeof sp.error === "string" ? sp.error : "";

  const gate = await requirePermission(permissions.orders.read);
  if (!gate.ok) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Geen toegang</h1>
        <p className="mt-2 text-sm text-zinc-600">Je hebt geen permissie om bestellingen te bekijken.</p>
      </div>
    );
  }

  const canWrite =
    gate.isAdmin ||
    hasPermission(gate.permissions, permissions.orders.write) ||
    hasPermission(gate.permissions, permissions.dashboard.access);

  const supabase = await createSupabaseServerClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id,status,total_cents,guest_name,guest_email,created_at,order_number")
    .eq("status", "ready_for_pickup")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        Kon orders niet laden: {error.message}
      </div>
    );
  }

  const rows = orders ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/orders" className="text-sm text-brand-blue hover:underline">
          ← Te maken bestellingen
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-brand-blue">Af te halen bestellingen</h1>
        <p className="mt-2 text-sm text-zinc-600">Orders die klaar staan om af te halen.</p>
      </div>

      {flashError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{flashError}</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600">Nog geen afhaalbestellingen.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bestelnummer</th>
                <th className="px-4 py-3">Klant</th>
                <th className="px-4 py-3">Totaal</th>
                <th className="px-4 py-3">Detail</th>
                <th className="px-4 py-3">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-800">
                    {o.created_at
                      ? new Date(o.created_at).toLocaleString("nl-NL", {
                          dateStyle: "short",
                          timeStyle: "short"
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{statusNl[o.status] ?? o.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-700">
                    {String((o as any).order_number ?? "").trim() || "—"}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-zinc-700" title={o.guest_email ?? ""}>
                    {o.guest_name ?? "—"}
                    {o.guest_email ? (
                      <>
                        <br />
                        <span className="text-xs text-zinc-500">{o.guest_email}</span>
                      </>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{eur(o.total_cents)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/orders/${o.id}`} className="text-brand-blue hover:underline">
                      Bekijken
                    </Link>
                  </td>
                  <td className="px-4 py-3">{canWrite ? <span className="text-zinc-400">Via detail</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

