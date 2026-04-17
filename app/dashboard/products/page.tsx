import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";
import { syncAllVariantSizesFromReorderRulesAction } from "@/app/dashboard/products/sync-sizes/actions";

export default async function DashboardProductsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.products.read);
  if (!gate.ok) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Geen toegang</h1>
        <p className="mt-2 text-sm text-zinc-600">Je hebt geen permissie om producten te bekijken.</p>
      </div>
    );
  }

  const sp = (await searchParams) ?? {};
  const ok = typeof sp.ok === "string" ? sp.ok : "";
  const updated = typeof sp.updated === "string" ? sp.updated : "";

  const supabase = await createSupabaseServerClient();
  const { data: products } = await supabase
    .from("products")
    .select("id,name,slug,price_cents,active,created_at,product_images(path,is_primary,sort_order,created_at)")
    .order("created_at", { ascending: false })
    .limit(100);

  const canSyncSizes = gate.isAdmin || gate.permissions.includes(permissions.dashboard.access) || gate.permissions.includes(permissions.stock.write);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Products</h1>
            <p className="mt-2 text-sm text-zinc-600">Beheer producten en afbeeldingen.</p>
          </div>
          <div className="flex gap-2">
            {canSyncSizes ? (
              <form action={syncAllVariantSizesFromReorderRulesAction}>
                <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50" type="submit">
                  Sync alle maten
                </button>
              </form>
            ) : null}
            <Link className="rounded-md border border-zinc-300 px-3 py-2 text-sm" href="/dashboard/products/categories">
              Categorieën
            </Link>
            <Link className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" href="/dashboard/products/new">
              Nieuw product
            </Link>
          </div>
        </div>
      </div>

      {ok === "sync_sizes" ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Maten gesynchroniseerd voor {updated || "alle"} producten.
        </p>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="divide-y divide-zinc-200">
          {(products ?? []).map((p) => {
            const primary =
              (p as any).product_images?.find((i: any) => i.is_primary) ??
              (p as any).product_images?.slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))?.[0];
            const img = getPublicProductImageUrl(primary?.path);
            return (
              <div key={p.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={img} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="mt-0.5 text-xs text-zinc-600">
                      € {(p.price_cents / 100).toFixed(2)} • {p.active ? "actief" : "inactief"} • {p.slug}
                    </div>
                  </div>
                </div>
                <Link className="text-sm text-brand-blue hover:underline" href={`/dashboard/products/${p.id}/edit`}>
                  Bewerken
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

