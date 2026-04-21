import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { NewDeliveryForm } from "@/components/dashboard/NewDeliveryForm";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { buildProductPickOptions } from "@/lib/stock/build-product-pick-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().uuid() });

const centsToNl = (cents: number | null | undefined) => {
  const c = Number(cents ?? 0);
  if (!Number.isFinite(c)) return "";
  return (c / 100).toFixed(2).replace(".", ",");
};

export default async function EditStockDeliveryPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const { id } = paramsSchema.parse(await params);
  const sp = (await searchParams) ?? {};
  const ok = sp.ok ? true : false;
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();

  const { data: delivery, error: dErr } = await supabase
    .from("stock_deliveries")
    .select("id,invoice_date,supplier,invoice_number,invoice_total_incl_cents,created_at")
    .eq("id", id)
    .single();
  if (dErr || !delivery) redirect("/dashboard/stock/levering/nieuw?error=Levering%20niet%20gevonden");

  const { data: batches, error: bErr } = await supabase
    .from("stock_batches")
    .select("product_id,variant_segment,size_label,quantity_received,unit_purchase_excl_cents")
    .eq("stock_delivery_id", id);
  if (bErr) redirect(`/dashboard/stock/levering/nieuw?error=${encodeURIComponent(bErr.message)}`);

  // Intern: toon alle producten (ook inactief), zodat je leveringen altijd kunt verwerken.
  const { data: allProducts } = await supabase
    .from("products")
    .select("id,name,printing_excl_cents,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize")
    .order("name");
  const options = buildProductPickOptions(allProducts ?? []);

  const defaults = {
    invoiceDate: delivery.invoice_date ? String(delivery.invoice_date) : "",
    supplier: delivery.supplier ?? "",
    invoiceNumber: delivery.invoice_number ?? "",
    invoiceTotalInclEuro:
      typeof (delivery as any).invoice_total_incl_cents === "number" ? centsToNl((delivery as any).invoice_total_incl_cents) : "",
    lines: (batches ?? []).map((r: any) => ({
      productId: r.product_id,
      variantSegment: r.variant_segment as any,
      quantity: Number(r.quantity_received ?? 1),
      sizeLabel: String(r.size_label ?? ""),
      unitExclEuro: centsToNl(r.unit_purchase_excl_cents)
    }))
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/dashboard/stock/levering/nieuw" className="text-sm text-brand-blue hover:underline">
          ← Terug naar nieuwe levering
        </Link>
        <h1 className="mt-4 text-xl font-semibold">Levering bewerken</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Let op: bewerken kan alleen zolang er nog geen voorraad uit deze levering is verbruikt.
        </p>
        {ok ? (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">Opgeslagen.</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <NewDeliveryForm products={options} defaults={defaults as any} deliveryId={id} />
      </div>
    </div>
  );
}

