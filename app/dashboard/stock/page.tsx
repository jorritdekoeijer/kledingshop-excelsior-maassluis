import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createBatchSchema, consumeStockSchema } from "@/lib/validation/stock";

async function createBatch(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  const parsed = createBatchSchema.safeParse({
    productId: formData.get("productId"),
    receivedAt: String(formData.get("receivedAt") ?? "") || undefined,
    quantityReceived: formData.get("quantityReceived"),
    note: String(formData.get("note") ?? "") || null
  });
  if (!parsed.success) redirect("/dashboard/stock?error=Invalid");

  const service = createSupabaseServiceClient();
  const { error } = await service.from("stock_batches").insert({
    product_id: parsed.data.productId,
    received_at: parsed.data.receivedAt ? new Date(parsed.data.receivedAt).toISOString() : undefined,
    quantity_received: parsed.data.quantityReceived,
    quantity_remaining: parsed.data.quantityReceived,
    note: parsed.data.note
  });
  if (error) redirect(`/dashboard/stock?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard/stock?ok=1");
}

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
        <p className="mt-2 text-sm text-zinc-600">Beheer batches en verbruik voorraad met FIFO.</p>

        {ok ? (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold">Nieuwe batch</h2>
          <form action={createBatch} className="mt-4 space-y-3">
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
                  name="quantityReceived"
                  defaultValue="0"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-700">Ontvangen op (optioneel)</span>
                <input
                  name="receivedAt"
                  placeholder="2026-04-10"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm text-zinc-700">Notitie</span>
              <input name="note" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
              Batch toevoegen
            </button>
          </form>
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
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-sm font-semibold">Voorraad per product</h2>
        </div>
        <div className="divide-y divide-zinc-200">
          {(products ?? []).map((p) => {
            const total = ((p as any).stock_batches ?? []).reduce((sum: number, b: any) => sum + (b.quantity_remaining ?? 0), 0);
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

