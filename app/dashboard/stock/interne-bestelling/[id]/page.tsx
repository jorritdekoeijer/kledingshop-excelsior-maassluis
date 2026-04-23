import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { centsToEuroString } from "@/lib/money/nl-euro";
import { InternalOrderCancelButton } from "@/components/dashboard/InternalOrderCancelButton";
import { InternalOrderRestoreStockButton } from "@/components/dashboard/InternalOrderRestoreStockButton";

export const dynamic = "force-dynamic";

export default async function InternalOrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.stock.read);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ? true : false;
  const error = typeof sp.error === "string" ? sp.error : "";

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: order, error: oErr } = await supabase
    .from("internal_orders")
    .select(
      "id,order_date,note,total_purchase_excl_cents,cost_group_id,cancelled_at,cancelled_note,stock_restored_at,cost_groups(name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (oErr) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
          ← Terug naar voorraad
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-semibold">Interne bestelling</h1>
          <p className="mt-2 text-sm text-red-700">Laden mislukt: {oErr.message}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
          ← Terug naar voorraad
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-semibold">Interne bestelling</h1>
          <p className="mt-2 text-sm text-zinc-600">Niet gevonden.</p>
        </div>
      </div>
    );
  }

  const { data: lines, error: lErr } = await supabase
    .from("internal_order_lines")
    .select("id,product_id,variant_segment,size_label,quantity,unit_purchase_excl_cents,line_total_purchase_excl_cents,products(name)")
    .eq("internal_order_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
          ← Terug naar voorraad
        </Link>
        <div className="flex items-center gap-2">
          {(order as any).cancelled_at ? null : (
            <Link
              href={`/dashboard/stock/interne-bestelling/${encodeURIComponent(id)}/edit`}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Bewerken
            </Link>
          )}
          {(order as any).cancelled_at ? null : <InternalOrderCancelButton id={String((order as any).id)} />}
          {(order as any).cancelled_at && !(order as any).stock_restored_at ? (
            <InternalOrderRestoreStockButton id={String((order as any).id)} />
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Interne bestelling</h1>
        {ok ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Opgeslagen.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {(order as any).cancelled_at ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-600">Status</dt>
              <dd className="mt-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                Geannuleerd
                {(order as any).cancelled_note ? (
                  <span className="ml-2 text-xs font-medium text-red-700">
                    — {String((order as any).cancelled_note)}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {(order as any).stock_restored_at ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-600">Voorraad</dt>
              <dd className="mt-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Hersteld
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-zinc-600">Datum</dt>
            <dd className="font-medium text-zinc-900">{String((order as any).order_date ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">Kostengroep</dt>
            <dd className="font-medium text-zinc-900">{((order as any).cost_groups as any)?.name ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-600">Omschrijving</dt>
            <dd className="whitespace-pre-wrap text-zinc-900">{String((order as any).note ?? "")}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">Totaal inkoop (excl. btw)</dt>
            <dd className="font-semibold tabular-nums text-brand-red">
              € {centsToEuroString(Number((order as any).total_purchase_excl_cents ?? 0))}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Regels</h2>
        {lErr ? <p className="mt-2 text-sm text-red-700">Regels laden mislukt: {lErr.message}</p> : null}
        {!lErr && (lines ?? []).length === 0 ? <p className="mt-2 text-sm text-zinc-500">Geen regels.</p> : null}

        {!lErr && (lines ?? []).length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Variant</th>
                  <th className="px-4 py-3">Maat</th>
                  <th className="px-4 py-3 text-right">Aantal</th>
                  <th className="px-4 py-3 text-right">Inkoop / stuk (excl.)</th>
                  <th className="px-4 py-3 text-right">Totaal (excl.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(lines ?? []).map((r: any) => (
                  <tr key={String(r.id)}>
                    <td className="px-4 py-3 text-zinc-900">{(r.products as any)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-700">{String(r.variant_segment ?? "—")}</td>
                    <td className="px-4 py-3 text-zinc-700">{String(r.size_label ?? "—")}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-900">{Number(r.quantity ?? 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-900">
                      {r.unit_purchase_excl_cents == null ? "—" : `€ ${centsToEuroString(Number(r.unit_purchase_excl_cents))}`}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                      € {centsToEuroString(Number(r.line_total_purchase_excl_cents ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

