import Link from "next/link";
import { redirect } from "next/navigation";
import { NewDeliveryForm, type ProductPickOption } from "@/components/dashboard/NewDeliveryForm";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { normalizeVariantBlock } from "@/lib/shop/product-json";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildProductOptions(
  rows: { id: string; name: string; variant_youth: unknown; variant_adult: unknown }[]
): ProductPickOption[] {
  return rows.map((p) => {
    const y = normalizeVariantBlock(p.variant_youth);
    const a = normalizeVariantBlock(p.variant_adult);
    const model = [y.model_number, a.model_number].map((m) => String(m || "").trim()).find(Boolean) ?? "";
    const sizes = [...new Set([...(y.sizes ?? []), ...(a.sizes ?? [])])];
    const label = model ? `${model} — ${p.name}` : p.name;
    return { id: p.id, label, sizes };
  });
}

export default async function NewStockDeliveryPage({
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
    .select("id,name,variant_youth,variant_adult")
    .eq("active", true)
    .order("name");

  const options = buildProductOptions(products ?? []);

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
    </div>
  );
}
