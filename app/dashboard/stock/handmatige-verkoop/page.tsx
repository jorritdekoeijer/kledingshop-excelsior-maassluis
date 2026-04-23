import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
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
  const { data: products, error: pErr } = await supabase.from("products").select("id,name,variant_youth,variant_adult").order("name");

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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
        ← Terug naar voorraad
      </Link>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Handmatige verkoop</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Registreer verkopen buiten deze webshop. Bij opslaan wordt voorraad FIFO afgeboekt en meegenomen in rapportage als “Inkoop
          verkopen”.
        </p>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <ManualSaleForm products={(products ?? []) as any} />
      </div>
    </div>
  );
}

