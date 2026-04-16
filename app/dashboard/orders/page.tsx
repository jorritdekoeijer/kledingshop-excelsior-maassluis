import Link from "next/link";
import { hasPermission, permissions } from "@/lib/auth/permissions";
import { requireOneOfPermissions } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

const statusNl: Record<string, string> = {
  created: "Aangemaakt",
  pending_payment: "Wacht op betaling",
  paid: "Betaald",
  cancelled: "Geannuleerd",
  fulfilled: "Afgehandeld",
  new_order: "Nieuwe bestelling",
  ready_for_pickup: "Klaar om af te halen",
  backorder: "Backorder",
  completed: "Afgerond"
};

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardOrdersPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const flashOk = sp.ok === "1" || sp.ok === "fulfilled";
  const flashMail = sp.mail === "sent";
  const flashError = typeof sp.error === "string" ? sp.error : "";

  const gate = await requireOneOfPermissions([permissions.orders.read, permissions.orderPick.read]);
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
    hasPermission(gate.permissions, permissions.orderPick.write) ||
    hasPermission(gate.permissions, permissions.dashboard.access);

  const supabase = await createSupabaseServerClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id,status,total_cents,guest_name,guest_email,created_at,fulfillment_error,public_token,confirmation_sent_at,order_number")
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
  const makeOrders = rows.filter((o) => o.status === "new_order" || o.status === "backorder");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-blue">Te maken bestellingen</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Bestellingen die betaald zijn en klaar staan om te picken. Klik op een bestelling om producten aan te vinken en
          klaar te zetten voor afhalen.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/dashboard/orders/afhalen" className="text-brand-blue hover:underline">
            → Af te halen bestellingen
          </Link>
        </p>
      </div>

      {flashOk ? <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">Opgeslagen.</p> : null}
      {flashMail ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Bevestigingsmail opnieuw verstuurd.
        </p>
      ) : null}
      {flashError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{flashError}</p>
      ) : null}

      {makeOrders.length === 0 ? (
        <p className="text-sm text-zinc-600">Nog geen bestellingen.</p>
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
                <th className="px-4 py-3">Mail</th>
                <th className="px-4 py-3">Bedankt</th>
                <th className="px-4 py-3">Detail</th>
                <th className="px-4 py-3">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {makeOrders.map((o) => (
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
                    {o.fulfillment_error ? (
                      <span className="ml-2 text-xs text-amber-800" title={o.fulfillment_error}>
                        (voorraad)
                      </span>
                    ) : null}
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
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-600">
                    {o.confirmation_sent_at
                      ? new Date(o.confirmation_sent_at).toLocaleString("nl-NL", {
                          dateStyle: "short",
                          timeStyle: "short"
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/checkout/bedankt?token=${o.public_token}`}
                      className="text-brand-blue hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Openen
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/orders/${o.id}`} className="text-brand-blue hover:underline">
                      Bekijken
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {canWrite ? <span className="text-zinc-400">Via detail</span> : <span className="text-zinc-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
