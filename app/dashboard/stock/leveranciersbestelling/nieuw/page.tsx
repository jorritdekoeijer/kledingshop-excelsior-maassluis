import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeVariantBlock } from "@/lib/shop/product-json";
import { NewSupplierOrderForm, type SupplierOrderSuggestionLine } from "@/components/dashboard/NewSupplierOrderForm";
import { buildProductPickOptions } from "@/lib/stock/build-product-pick-options";
import { sendExistingSupplierOrderAction } from "@/app/dashboard/stock/leveranciersbestelling/nieuw/actions";

export const dynamic = "force-dynamic";

type VariantSegment = "youth" | "adult";

export default async function NewSupplierOrderPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const sp = (await searchParams) ?? {};
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id,name,email")
    .order("name");

  const { data: previousOrders } = await supabase
    .from("supplier_orders")
    .select(
      "id,order_date,supplier,status,note,created_at,supplier_order_lines(quantity,variant_segment,size_label,products(name))"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: products } = await supabase
    .from("products")
    .select("id,name,variant_youth,variant_adult,stock_batches(quantity_remaining,variant_segment,size_label)")
    .eq("active", true)
    .order("name");

  const productOptions = buildProductPickOptions(products ?? []);
  const stockEntries: { productId: string; variantSegment: VariantSegment; sizeLabel: string; qty: number }[] = [];

  const { data: rules } = await supabase
    .from("stock_reorder_rules")
    .select("product_id,variant_segment,size_label,is_active,threshold_qty,target_qty")
    .eq("is_active", true);

  type BatchRow = { quantity_remaining: number | null; variant_segment: string | null; size_label: string | null };
  const stockMap = new Map<string, number>();

  for (const p of products ?? []) {
    const batches = ((p as { stock_batches?: BatchRow[] }).stock_batches ?? []) as BatchRow[];
    for (const b of batches) {
      const qty = b.quantity_remaining ?? 0;
      if (qty <= 0) continue;
      const variant = String(b.variant_segment ?? "").trim();
      const size = String(b.size_label ?? "").trim();
      if (variant !== "youth" && variant !== "adult") continue;
      if (!size) continue;
      const key = `${p.id}\0${variant}\0${size}`;
      stockMap.set(key, (stockMap.get(key) ?? 0) + qty);
      stockEntries.push({ productId: p.id, variantSegment: variant as VariantSegment, sizeLabel: size, qty });
    }
  }

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  const suggestions: SupplierOrderSuggestionLine[] = [];
  for (const r of rules ?? []) {
    const productId = String((r as any).product_id);
    const variantSegment = String((r as any).variant_segment).trim() as VariantSegment;
    const sizeLabel = String((r as any).size_label).trim();
    const thresholdQty = Number((r as any).threshold_qty ?? 0);
    const targetQty = Number((r as any).target_qty ?? 0);
    if (!productId || (variantSegment !== "youth" && variantSegment !== "adult") || !sizeLabel) continue;

    const p = productMap.get(productId) as any;
    if (!p) continue;

    const currentStock = stockMap.get(`${productId}\0${variantSegment}\0${sizeLabel}`) ?? 0;
    if (currentStock > thresholdQty) continue;

    const suggestedQty = Math.max(0, targetQty - currentStock);
    if (suggestedQty <= 0) continue;

    const vb = variantSegment === "youth" ? normalizeVariantBlock(p.variant_youth) : normalizeVariantBlock(p.variant_adult);
    const articleCode = String(vb.model_number ?? "").trim();

    suggestions.push({
      productId,
      productName: String(p.name ?? ""),
      articleCode,
      variantSegment,
      sizeLabel,
      currentStock,
      thresholdQty,
      targetQty,
      suggestedQty
    });
  }

  suggestions.sort((a, b) => {
    const c = a.productName.localeCompare(b.productName, "nl");
    if (c !== 0) return c;
    const v = a.variantSegment.localeCompare(b.variantSegment);
    if (v !== 0) return v;
    return a.sizeLabel.localeCompare(b.sizeLabel, "nl");
  });

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const defaultDate = `${yyyy}-${mm}-${dd}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
          ← Terug naar voorraad
        </Link>
        <h1 className="mt-4 text-xl font-semibold">Nieuwe leveranciersbestelling</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Automatische aanvulregels op basis van drempelwaarden per maat. Je kunt het aantal alleen naar boven bijstellen.
        </p>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <NewSupplierOrderForm
          defaultDate={defaultDate}
          suppliers={(suppliers ?? []) as any}
          products={(productOptions ?? []) as any}
          stock={stockEntries}
          suggestions={suggestions}
        />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Eerdere leveranciersbestellingen</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Overzicht van recente bestellingen. Concepten kun je hier alsnog versturen.
        </p>

        {(previousOrders ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nog geen bestellingen.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {(previousOrders ?? []).map((o: any) => {
              const lines = (o.supplier_order_lines ?? []) as any[];
              return (
                <details key={o.id} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          {o.order_date} — {o.supplier ?? "—"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Status: <span className="font-medium">{String(o.status ?? "")}</span> · Regels:{" "}
                          <span className="font-medium">{lines.length}</span>
                        </div>
                      </div>
                      {String(o.status) === "draft" ? (
                        <form action={sendExistingSupplierOrderAction.bind(null, String(o.id))}>
                          <button
                            type="submit"
                            className="rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
                          >
                            Verstuur
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </summary>

                  {o.note ? <p className="mt-3 text-sm text-zinc-700">Opmerking: {o.note}</p> : null}

                  <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200 bg-white">
                    <table className="w-full min-w-[36rem] text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          <th className="px-3 py-2">Product</th>
                          <th className="px-3 py-2">Variant</th>
                          <th className="px-3 py-2">Maat</th>
                          <th className="px-3 py-2 text-right">Aantal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {lines.map((l) => (
                          <tr key={`${o.id}-${l.variant_segment}-${l.size_label}-${l.product_id}`}>
                            <td className="px-3 py-2">{l.products?.name ?? "—"}</td>
                            <td className="px-3 py-2">{l.variant_segment === "youth" ? "YOUTH" : "ADULT"}</td>
                            <td className="px-3 py-2 font-mono">{l.size_label}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

