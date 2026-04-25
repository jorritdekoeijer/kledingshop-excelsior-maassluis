import Link from "next/link";
import { redirect } from "next/navigation";
import { NewDeliveryForm } from "@/components/dashboard/NewDeliveryForm";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { buildProductPickOptions } from "@/lib/stock/build-product-pick-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

export default async function NewStockDeliveryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const sp = (await searchParams) ?? {};
  const error = typeof sp.error === "string" ? sp.error : "";
  const pageRaw = typeof sp.page === "string" ? sp.page : "1";
  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const pageSize = 30;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createSupabaseServerClient();
  const { data: products } = await supabase
    .from("products")
    .select("id,name,printing_excl_cents,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize")
    .order("name");

  const { data: deliveries, error: delErr } = await supabase
    .from("stock_deliveries")
    .select("id,supplier,invoice_date,invoice_number,invoice_total_incl_cents,created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  const options = buildProductPickOptions(products ?? []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
          ← Terug naar voorraad
        </Link>
        <h1 className="mt-4 text-xl font-semibold">Nieuwe levering</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Registreer een inkoopfactuur met regels per product en maat. Inkoop is excl. btw; onderaan zie je de controle
          incl. btw.
        </p>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <NewDeliveryForm products={options} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Ingediende facturen</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Overzicht van recente leveringen (factuurkop). Bedrukkingskosten tellen niet mee in het factuurbedrag.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <p className="text-zinc-600">
            Pagina <span className="font-semibold text-zinc-900">{page}</span>
          </p>
          <div className="flex gap-2">
            <Link
              aria-disabled={page <= 1}
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                page <= 1 ? "cursor-not-allowed border-zinc-200 text-zinc-400" : "border-zinc-300 text-zinc-800 hover:bg-zinc-50"
              }`}
              href={page <= 1 ? "/dashboard/stock/levering/nieuw" : `/dashboard/stock/levering/nieuw?page=${page - 1}`}
            >
              Vorige
            </Link>
            <Link
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              href={`/dashboard/stock/levering/nieuw?page=${page + 1}`}
            >
              Volgende
            </Link>
          </div>
        </div>

        {delErr ? (
          <p className="mt-4 text-sm text-red-700">Leveringen laden mislukt: {delErr.message}</p>
        ) : (deliveries ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nog geen leveringen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3">Leverancier</th>
                  <th className="px-4 py-3">Factuurdatum</th>
                  <th className="px-4 py-3">Factuurnummer</th>
                  <th className="px-4 py-3 text-right">Factuurbedrag (incl. btw)</th>
                  <th className="px-4 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(deliveries ?? []).map((d, i) => (
                  <tr key={`${String(d.invoice_number ?? "")}-${String(d.created_at ?? "")}-${i}`}>
                    <td className="px-4 py-3 text-zinc-800">{d.supplier ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-700">{d.invoice_date ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">{d.invoice_number ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {typeof (d as any).invoice_total_incl_cents === "number" ? eur((d as any).invoice_total_incl_cents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="text-sm font-medium text-brand-blue hover:underline"
                        href={`/dashboard/stock/levering/${(d as any).id}/edit`}
                      >
                        Bewerken
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
