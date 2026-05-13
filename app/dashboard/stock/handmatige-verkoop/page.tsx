import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { buildProductPickOptions } from "@/lib/stock/build-product-pick-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ManualSaleForm } from "@/components/dashboard/ManualSaleForm";
import { centsToEuroString } from "@/lib/money/nl-euro";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function formatDateNl(d: string | null | undefined): string {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(d);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export default async function HandmatigeVerkoopPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const sp = (await searchParams) ?? {};
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id,name,is_set,price_cents,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize")
    .order("name");

  if (pErr) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
          ← Terug naar voorraad
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-semibold">Handmatige verkoop</h1>
          <p className="mt-2 text-sm text-red-700">Producten laden mislukt: {pErr.message}</p>
        </div>
      </div>
    );
  }

  // Componenten van set-producten ophalen zodat de form per set de componenten kent.
  const setIds = (products ?? []).filter((p) => (p as any).is_set).map((p) => p.id);
  let setComponentDefs: {
    setProductId: string;
    componentProductId: string;
    quantity: number;
    sortOrder: number;
    optionGroup: string | null;
    optionGroupLabel: string | null;
  }[] = [];
  if (setIds.length > 0) {
    const firstQ = await supabase
      .from("product_set_components")
      .select("set_product_id,component_product_id,quantity,sort_order,option_group,option_group_label")
      .in("set_product_id", setIds)
      .order("sort_order", { ascending: true });
    let comps: any[] | null = null;
    if (firstQ.error) {
      const code = String((firstQ.error as any)?.code ?? "");
      const msg = String((firstQ.error as any)?.message ?? "").toLowerCase();
      if (code === "42703" || msg.includes("option_group_label")) {
        const second = await supabase
          .from("product_set_components")
          .select("set_product_id,component_product_id,quantity,sort_order,option_group")
          .in("set_product_id", setIds)
          .order("sort_order", { ascending: true });
        if (second.error) {
          const c2 = String((second.error as any)?.code ?? "");
          const m2 = String((second.error as any)?.message ?? "").toLowerCase();
          if (c2 === "42703" || m2.includes("option_group")) {
            const fb = await supabase
              .from("product_set_components")
              .select("set_product_id,component_product_id,quantity,sort_order")
              .in("set_product_id", setIds)
              .order("sort_order", { ascending: true });
            comps = (fb.data ?? []).map((c: any) => ({
              ...c,
              option_group: null,
              option_group_label: null
            }));
          }
        } else {
          comps = (second.data ?? []).map((c: any) => ({ ...c, option_group_label: null }));
        }
      } else if (code === "42703" || msg.includes("option_group")) {
        const fb = await supabase
          .from("product_set_components")
          .select("set_product_id,component_product_id,quantity,sort_order")
          .in("set_product_id", setIds)
          .order("sort_order", { ascending: true });
        comps = (fb.data ?? []).map((c: any) => ({
          ...c,
          option_group: null,
          option_group_label: null
        }));
      }
    } else {
      comps = firstQ.data ?? [];
    }
    setComponentDefs = (comps ?? []).map((c: any) => ({
      setProductId: c.set_product_id as string,
      componentProductId: c.component_product_id as string,
      quantity: Number(c.quantity ?? 1),
      sortOrder: Number(c.sort_order ?? 0),
      optionGroup:
        typeof c.option_group === "string" && c.option_group.trim().length > 0
          ? c.option_group.trim()
          : null,
      optionGroupLabel:
        typeof c.option_group_label === "string" && c.option_group_label.trim().length > 0
          ? c.option_group_label.trim()
          : null
    }));
  }

  const pickOptions = buildProductPickOptions((products ?? []) as any);
  const productMeta = (products ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    isSet: Boolean((p as any).is_set ?? false),
    setPriceInclCents: Number((p as any).price_cents ?? 0)
  }));
  const productNameById = new Map<string, string>(productMeta.map((m) => [m.id, m.name]));

  // Paginering voor het overzicht
  const pageRaw = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  // Manual sales + count + bijbehorende regels (in twee queries)
  type SaleRow = { id: string; sale_date: string; note: string | null; created_at: string };
  type LineRow = {
    id: string;
    manual_sale_id: string;
    product_id: string | null;
    is_set: boolean;
    quantity: number;
    unit_revenue_incl_cents: number;
    variant_segment: string | null;
    size_label: string | null;
  };
  let salesRows: SaleRow[] = [];
  let linesBySale: Map<string, LineRow[]> = new Map();
  let salesTotalCount = 0;
  let salesTableMissing = false;
  let salesLoadError: string | null = null;

  const salesQuery = await supabase
    .from("manual_sales")
    .select("id,sale_date,note,created_at", { count: "exact" })
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (salesQuery.error) {
    const code = String((salesQuery.error as any)?.code ?? "");
    const msg = String((salesQuery.error as any)?.message ?? "").toLowerCase();
    if (code === "PGRST205" || msg.includes("manual_sales")) {
      salesTableMissing = true;
    } else {
      salesLoadError = salesQuery.error.message;
    }
  } else {
    salesRows = (salesQuery.data ?? []) as SaleRow[];
    salesTotalCount = salesQuery.count ?? salesRows.length;
    if (salesRows.length > 0) {
      const ids = salesRows.map((r) => r.id);
      const linesQ = await supabase
        .from("manual_sale_lines")
        .select("id,manual_sale_id,product_id,is_set,quantity,unit_revenue_incl_cents,variant_segment,size_label")
        .in("manual_sale_id", ids)
        .order("created_at", { ascending: true });
      if (linesQ.error) {
        salesLoadError = linesQ.error.message;
      } else {
        for (const row of (linesQ.data ?? []) as LineRow[]) {
          const arr = linesBySale.get(row.manual_sale_id) ?? [];
          arr.push(row);
          linesBySale.set(row.manual_sale_id, arr);
        }
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(salesTotalCount / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
        ← Terug naar voorraad
      </Link>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Handmatige verkoop</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Registreer verkopen buiten deze webshop. Bij opslaan wordt voorraad FIFO afgeboekt en meegenomen in rapportage als “Inkoop
          verkopen”. Set-producten kun je ook selecteren — voorraad wordt per component afgeboekt en de setprijs telt als omzet.
        </p>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <ManualSaleForm products={pickOptions} productMeta={productMeta} setComponentDefs={setComponentDefs} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Geboekte handmatige verkopen</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Overzicht van alle geregistreerde handmatige verkopen, nieuwste eerst.
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            {salesTableMissing
              ? ""
              : `${salesTotalCount} ${salesTotalCount === 1 ? "verkoop" : "verkopen"}`}
          </p>
        </div>

        {salesTableMissing ? (
          <p className="mt-4 text-sm text-zinc-500">
            Nog niet beschikbaar — draai migratie <code>0045_manual_sales_tables.sql</code> in Supabase.
          </p>
        ) : salesLoadError ? (
          <p className="mt-4 text-sm text-red-700">Verkopen laden mislukt: {salesLoadError}</p>
        ) : salesRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nog geen handmatige verkopen geregistreerd.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {salesRows.map((sale) => {
              const lines = linesBySale.get(sale.id) ?? [];
              const totalRevenue = lines.reduce(
                (acc, l) => acc + Number(l.quantity ?? 0) * Number(l.unit_revenue_incl_cents ?? 0),
                0
              );
              const totalQty = lines.reduce((acc, l) => acc + Number(l.quantity ?? 0), 0);
              return (
                <div key={sale.id} className="overflow-hidden rounded-lg border border-zinc-200">
                  <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900">
                        {formatDateNl(sale.sale_date)}{" "}
                        <span className="text-xs font-normal text-zinc-500">
                          · {lines.length} {lines.length === 1 ? "regel" : "regels"}
                          {totalQty > 0 ? ` · ${totalQty} ${totalQty === 1 ? "stuk" : "stuks"}` : ""}
                        </span>
                      </p>
                      {sale.note ? (
                        <p className="mt-0.5 text-xs text-zinc-600">{sale.note}</p>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-zinc-900">
                      € {centsToEuroString(totalRevenue)}
                    </p>
                  </div>

                  {lines.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-zinc-500">Geen regels gevonden voor deze verkoop.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="border-b border-zinc-100 bg-white text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          <tr>
                            <th className="px-4 py-2">Product</th>
                            <th className="px-4 py-2">Variant</th>
                            <th className="px-4 py-2">Maat</th>
                            <th className="px-4 py-2 text-right">Aantal</th>
                            <th className="px-4 py-2 text-right">Stuksprijs (incl.)</th>
                            <th className="px-4 py-2 text-right">Totaal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {lines.map((l) => {
                            const name = l.product_id
                              ? productNameById.get(l.product_id) ?? "—"
                              : "—";
                            const lineTotal = Number(l.quantity ?? 0) * Number(l.unit_revenue_incl_cents ?? 0);
                            const variant = l.is_set
                              ? "SET"
                              : l.variant_segment
                                ? l.variant_segment.toUpperCase()
                                : "—";
                            return (
                              <tr key={l.id}>
                                <td className="px-4 py-2 text-zinc-800">
                                  {l.is_set ? <span className="mr-1 text-xs font-semibold text-brand-blue">[SET]</span> : null}
                                  {name}
                                </td>
                                <td className="px-4 py-2 text-zinc-700">{variant}</td>
                                <td className="px-4 py-2 text-zinc-700">{l.is_set ? "—" : l.size_label ?? "—"}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{l.quantity}</td>
                                <td className="px-4 py-2 text-right tabular-nums">
                                  € {centsToEuroString(Number(l.unit_revenue_incl_cents ?? 0))}
                                </td>
                                <td className="px-4 py-2 text-right font-medium tabular-nums">
                                  € {centsToEuroString(lineTotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-zinc-200 pt-3 text-sm">
                <span className="text-zinc-600">
                  Pagina {page} van {totalPages}
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/dashboard/stock/handmatige-verkoop?page=${page - 1}`}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      ← Vorige
                    </Link>
                  ) : null}
                  {page < totalPages ? (
                    <Link
                      href={`/dashboard/stock/handmatige-verkoop?page=${page + 1}`}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      Volgende →
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

