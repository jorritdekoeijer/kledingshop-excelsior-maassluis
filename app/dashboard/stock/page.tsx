import Link from "next/link";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeVariantBlock } from "@/lib/shop/product-json";
import { StockRowsTable, type StockRow } from "@/components/dashboard/StockRowsTable";

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
  const { data: products } = await supabase
    .from("products")
    .select("id,name,active,variant_youth,variant_adult,stock_batches(quantity_remaining,variant_segment,size_label)")
    .order("name");

  type BatchRow = {
    quantity_remaining: number | null;
    variant_segment: string | null;
    size_label: string | null;
  };

  const stockRows: StockRow[] = [];

  for (const p of products ?? []) {
    const batches = ((p as { stock_batches?: BatchRow[] }).stock_batches ?? []) as BatchRow[];
    const youthCode = String(normalizeVariantBlock((p as any).variant_youth).model_number ?? "").trim();
    const adultCode = String(normalizeVariantBlock((p as any).variant_adult).model_number ?? "").trim();
    const agg = new Map<string, number>();
    for (const b of batches) {
      const vr = b.variant_segment != null && String(b.variant_segment).trim() !== "" ? String(b.variant_segment).trim() : "";
      const sz = b.size_label != null && String(b.size_label).trim() !== "" ? String(b.size_label).trim() : "";
      const key = `${vr}\0${sz}`;
      agg.set(key, (agg.get(key) ?? 0) + (b.quantity_remaining ?? 0));
    }
    if (agg.size === 0) {
      stockRows.push({ name: p.name, articleCode: "", variantLabel: "—", sizeLabel: "—", qty: 0 });
      continue;
    }
    const lines: StockRow[] = [];
    for (const [key, qty] of agg) {
      if (qty <= 0) continue;
      const [vr, sz] = key.split("\0");
      const articleCode = vr === "youth" ? youthCode : vr === "adult" ? adultCode : "";
      lines.push({
        name: p.name,
        articleCode,
        variantLabel: formatVariantSegment(vr || null),
        sizeLabel: formatSizeLabel(sz || null),
        qty
      });
    }
    if (lines.length === 0) {
      stockRows.push({ name: p.name, articleCode: "", variantLabel: "—", sizeLabel: "—", qty: 0 });
    } else {
      stockRows.push(...lines);
    }
  }

  stockRows.sort((a, b) => {
    const c = a.name.localeCompare(b.name, "nl");
    if (c !== 0) return c;
    const v = a.variantLabel.localeCompare(b.variantLabel, "nl");
    if (v !== 0) return v;
    return a.sizeLabel.localeCompare(b.sizeLabel, "nl");
  });

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
    </div>
  );
}
