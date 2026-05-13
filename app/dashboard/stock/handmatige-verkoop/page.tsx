import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { buildProductPickOptions } from "@/lib/stock/build-product-pick-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ManualSaleForm } from "@/components/dashboard/ManualSaleForm";

export const dynamic = "force-dynamic";

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
  let setComponentDefs: { setProductId: string; componentProductId: string; quantity: number; sortOrder: number }[] = [];
  if (setIds.length > 0) {
    const { data: comps } = await supabase
      .from("product_set_components")
      .select("set_product_id,component_product_id,quantity,sort_order")
      .in("set_product_id", setIds)
      .order("sort_order", { ascending: true });
    setComponentDefs = (comps ?? []).map((c: any) => ({
      setProductId: c.set_product_id as string,
      componentProductId: c.component_product_id as string,
      quantity: Number(c.quantity ?? 1),
      sortOrder: Number(c.sort_order ?? 0)
    }));
  }

  const pickOptions = buildProductPickOptions((products ?? []) as any);
  const productMeta = (products ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    isSet: Boolean((p as any).is_set ?? false),
    setPriceInclCents: Number((p as any).price_cents ?? 0)
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
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
    </div>
  );
}

