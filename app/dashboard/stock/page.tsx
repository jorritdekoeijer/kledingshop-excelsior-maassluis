import Link from "next/link";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeVariantBlock } from "@/lib/shop/product-json";
import { StockRowsTable, type StockRow } from "@/components/dashboard/StockRowsTable";
import { centsToEuroString } from "@/lib/money/nl-euro";

export const dynamic = "force-dynamic";

function formatVariantSegment(v: string | null | undefined): string {
  if (v == null || v === "") return "—";
  if (v === "youth") return "Jeugd (YOUTH)";
  if (v === "adult") return "Volwassenen (ADULT)";
  return String(v);
}

function formatSizeLabel(s: string | null | undefined): string {
  const t = s != null ? String(s).trim() : "";
  return t === "" ? "—" : t;
}

export default async function DashboardStockPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.stock.read);
  if (!gate.ok) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Geen toegang</h1>
        <p className="mt-2 text-sm text-zinc-600">Je hebt geen permissie om voorraad te bekijken.</p>
      </div>
    );
  }

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ? true : false;
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();

  const stockRows: StockRow[] = [];

  // Toon alle producten (ook met 0 voorraad), maar aggregeer de voorraad direct uit stock_batches.
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id,name,variant_youth,variant_adult")
    .order("name");
  if (pErr) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Voorraad</h1>
        <p className="mt-2 text-sm text-red-700">Producten laden mislukt: {pErr.message}</p>
      </div>
    );
  }

  const { data: batches, error: bErr } = await supabase
    .from("stock_batches")
    .select("product_id,quantity_remaining,variant_segment,size_label");
  if (bErr) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Voorraad</h1>
        <p className="mt-2 text-sm text-red-700">Voorraad laden mislukt: {bErr.message}</p>
      </div>
    );
  }

  const agg = new Map<string, number>();
  for (const r of (batches ?? []) as any[]) {
    const productId = String((r as any).product_id ?? "");
    if (!productId) continue;
    const vr = (r as any).variant_segment != null && String((r as any).variant_segment).trim() !== "" ? String((r as any).variant_segment).trim() : "";
    const sz = (r as any).size_label != null && String((r as any).size_label).trim() !== "" ? String((r as any).size_label).trim() : "";
    const key = `${productId}\0${vr}\0${sz}`;
    const q = Number((r as any).quantity_remaining ?? 0);
    agg.set(key, (agg.get(key) ?? 0) + (Number.isFinite(q) ? q : 0));
  }

  for (const p of products ?? []) {
    const youthCode = String(normalizeVariantBlock((p as any).variant_youth).model_number ?? "").trim();
    const adultCode = String(normalizeVariantBlock((p as any).variant_adult).model_number ?? "").trim();

    const keys = [...agg.keys()].filter((k) => k.startsWith(`${p.id}\0`));
    if (keys.length === 0) {
      stockRows.push({ name: p.name, articleCode: "", variantLabel: "—", sizeLabel: "—", qty: 0 });
      continue;
    }
    for (const key of keys) {
      const [, vr, sz] = key.split("\0");
      const qty = agg.get(key) ?? 0;
      if (qty <= 0) continue;
      const articleCode = vr === "youth" ? youthCode : vr === "adult" ? adultCode : "";
      stockRows.push({
        name: p.name,
        articleCode,
        variantLabel: formatVariantSegment(vr || null),
        sizeLabel: formatSizeLabel(sz || null),
        qty
      });
    }
  }

  stockRows.sort((a, b) => {
    const c = a.name.localeCompare(b.name, "nl");
    if (c !== 0) return c;
    const v = a.variantLabel.localeCompare(b.variantLabel, "nl");
    if (v !== 0) return v;
    return a.sizeLabel.localeCompare(b.sizeLabel, "nl");
  });

  // Recente interne bestellingen (optioneel; tabel kan ontbreken in oudere schema's).
  const { data: internalOrders, error: ioErr } = await supabase
    .from("internal_orders")
    .select("id,order_date,note,total_purchase_excl_cents,cost_groups(name)")
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  const internalOrdersMissing =
    Boolean((ioErr as any)?.code === "PGRST205") ||
    String((ioErr as any)?.message ?? "").toLowerCase().includes("internal_orders");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Voorraad</h1>
        <p className="mt-2 text-sm text-zinc-600">Beheer voorraad per product, variant (jeugd/volwassen) en maat</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/stock/levering/nieuw"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            Nieuwe levering
          </Link>
          <Link
            href="/dashboard/stock/interne-bestelling"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Interne bestelling
          </Link>
          <Link
            href="/dashboard/stock/leveranciersbestelling/nieuw"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Nieuwe leveranciersbestelling
          </Link>
        </div>

        {ok ? (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <StockRowsTable rows={stockRows} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Recente interne bestellingen</h2>
        <p className="mt-2 text-sm text-zinc-600">Overzicht van de laatste interne afboekingen (excl. btw).</p>

        {internalOrdersMissing ? (
          <p className="mt-4 text-sm text-zinc-500">Nog niet beschikbaar (draai migratie `0017_internal_orders.sql`).</p>
        ) : ioErr ? (
          <p className="mt-4 text-sm text-red-700">Kon interne bestellingen niet laden: {ioErr.message}</p>
        ) : (internalOrders ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nog geen interne bestellingen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Kostengroep</th>
                  <th className="px-4 py-3">Omschrijving</th>
                  <th className="px-4 py-3 text-right">Totaal inkoop (excl.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(internalOrders ?? []).map((o: any) => (
                  <tr key={String(o.id)}>
                    <td className="px-4 py-3 text-zinc-700">{String(o.order_date ?? "—")}</td>
                    <td className="px-4 py-3 text-zinc-800">{(o.cost_groups as any)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-700">{String(o.note ?? "")}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      € {centsToEuroString(Number(o.total_purchase_excl_cents ?? 0))}
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
