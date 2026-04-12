import Link from "next/link";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { consumeStockSchema } from "@/lib/validation/stock";

async function consumeStock(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const parsed = consumeStockSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    reason: String(formData.get("reason") ?? "sale")
  });
  if (!parsed.success) redirect("/dashboard/stock?error=Invalid");

  const service = createSupabaseServiceClient();
  const { error } = await service.rpc("consume_stock_fifo", {
    p_product_id: parsed.data.productId,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason
  });
  if (error) redirect(`/dashboard/stock?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard/stock?ok=1");
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
    .select("id,name,active,stock_batches(quantity_remaining)")
    .order("name");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Voorraad</h1>
        <p className="mt-2 text-sm text-zinc-600">Beheer voorraad per product</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/stock/levering/nieuw"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            1. Nieuwe levering
          </Link>
          <Link
            href="/dashboard/stock/interne-bestelling"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            2. Interne bestelling
          </Link>
        </div>

        {ok ? (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold">Voorraad verbruiken (FIFO)</h2>
        <form action={consumeStock} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm text-zinc-700">Product</span>
            <select name="productId" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-zinc-700">Aantal</span>
              <input
                name="quantity"
                defaultValue="1"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-700">Reden</span>
              <input
                name="reason"
                defaultValue="sale"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button className="rounded-md bg-brand-red px-3 py-2 text-sm font-medium text-white" type="submit">
            Verbruik
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-sm font-semibold">Voorraad per product</h2>
        </div>
        <div className="divide-y divide-zinc-200">
          {(products ?? []).map((p) => {
            const total = ((p as { stock_batches?: { quantity_remaining: number }[] }).stock_batches ?? []).reduce(
              (sum, b) => sum + (b.quantity_remaining ?? 0),
              0
            );
            return (
              <div key={p.id} className="flex items-center justify-between px-6 py-3">
                <div className="text-sm">{p.name}</div>
                <div className="text-sm text-zinc-700">{total}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
