import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { buildProductPickOptions } from "@/lib/stock/build-product-pick-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InternalOrderForm } from "@/components/dashboard/InternalOrderForm";

export default async function InterneBestellingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const sp = (await searchParams) ?? {};
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();
  const { data: products } = await supabase
    .from("products")
    .select(
      "id,name,printing_excl_cents,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize,stock_batches(quantity_remaining,variant_segment,size_label,unit_purchase_excl_cents,unit_printing_excl_cents,received_at,created_at)"
    )
    .order("name");

  const { data: costGroups } = await supabase.from("cost_groups").select("id,name").order("created_at");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
        ← Terug naar voorraad
      </Link>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Interne bestelling</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Registreer intern verbruik. Bij opslaan wordt de voorraad (FIFO) afgeboekt per product, jeugd/volwassen en maat.
        </p>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <InternalOrderForm
          products={buildProductPickOptions((products ?? []) as any).map((o) => ({
            ...o,
            stock_batches: ((products ?? []) as any[]).find((p) => String(p.id) === String(o.id))?.stock_batches ?? []
          })) as any}
          costGroups={(costGroups ?? []) as any}
        />
      </div>
    </div>
  );
}
