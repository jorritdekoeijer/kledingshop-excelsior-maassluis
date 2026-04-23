import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InternalOrderRebookForm } from "@/components/dashboard/InternalOrderRebookForm";

export const dynamic = "force-dynamic";

export default async function InternalOrderEditPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const sp = (await searchParams) ?? {};
  const error = typeof sp.error === "string" ? sp.error : "";

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: order, error: oErr } = await supabase
    .from("internal_orders")
    .select("id,order_date,cost_group_id,note")
    .eq("id", id)
    .maybeSingle();

  const { data: lines, error: lErr } = await supabase
    .from("internal_order_lines")
    .select("product_id,variant_segment,size_label,quantity")
    .eq("internal_order_id", id)
    .order("created_at", { ascending: true });

  const { data: costGroups, error: cgErr } = await supabase.from("cost_groups").select("id,name").order("created_at");

  const { data: products, error: pErr } = await supabase
    .from("products")
    .select(
      "id,name,variant_youth,variant_adult,stock_batches(quantity_remaining,variant_segment,size_label,unit_purchase_excl_cents,unit_printing_excl_cents,received_at,created_at)"
    )
    .order("name");

  if (oErr || !order) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={`/dashboard/stock/interne-bestelling/${encodeURIComponent(id)}`} className="text-sm text-brand-blue hover:underline">
          ← Terug
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-semibold">Interne bestelling bewerken</h1>
          <p className="mt-2 text-sm text-red-700">{oErr ? oErr.message : "Niet gevonden."}</p>
        </div>
      </div>
    );
  }

  if (cgErr) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={`/dashboard/stock/interne-bestelling/${encodeURIComponent(id)}`} className="text-sm text-brand-blue hover:underline">
          ← Terug
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-semibold">Interne bestelling bewerken</h1>
          <p className="mt-2 text-sm text-red-700">Kostengroepen laden mislukt: {cgErr.message}</p>
        </div>
      </div>
    );
  }

  if (pErr) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href={`/dashboard/stock/interne-bestelling/${encodeURIComponent(id)}`} className="text-sm text-brand-blue hover:underline">
          ← Terug
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-semibold">Interne bestelling bewerken</h1>
          <p className="mt-2 text-sm text-red-700">Producten laden mislukt: {pErr.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/dashboard/stock/interne-bestelling/${encodeURIComponent(id)}`} className="text-sm text-brand-blue hover:underline">
        ← Terug naar interne bestelling
      </Link>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Interne bestelling bewerken</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Je kunt datum, kostengroep, omschrijving en regels aanpassen. Bij opslaan wordt de bestelling herboekt (oude afboeking
          terug, nieuwe afboeking opnieuw).
        </p>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {lErr ? <p className="mt-4 text-sm text-red-700">Regels laden mislukt: {lErr.message}</p> : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <InternalOrderRebookForm
          defaults={{
            id: String(order.id),
            orderDate: String((order as any).order_date ?? ""),
            costGroupId: String((order as any).cost_group_id ?? ""),
            note: String((order as any).note ?? ""),
            lines: (lines ?? []).map((r: any) => ({
              productId: String(r.product_id ?? ""),
              variantSegment: (String(r.variant_segment ?? "") as any) === "youth" ? "youth" : "adult",
              sizeLabel: String(r.size_label ?? ""),
              quantity: Number(r.quantity ?? 1)
            }))
          }}
          products={(products ?? []) as any}
          costGroups={(costGroups ?? []) as any}
        />
      </div>
    </div>
  );
}

