import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";
import { ProductCard } from "@/components/shop/ProductCard";
import { pickPrimaryImagePath } from "@/lib/shop/product-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Assortiment | Kledingshop Excelsior Maassluis",
  description: "Bekijk het assortiment clubkleding en artikelen."
};

function excerpt(text: string | null, max = 120) {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export default async function ShopPage() {
  const supabase = await createSupabaseServerClient();
  const { data: products } = await supabase
    .from("products")
    .select("name,slug,price_cents,description,product_images(path,is_primary,sort_order)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-brand-blue">Assortiment</h1>
            <p className="mt-1 text-sm text-zinc-600">Alle actieve producten.</p>
          </div>
          <Link href="/" className="text-sm text-brand-blue hover:underline">
            ← Terug naar home
          </Link>
        </div>

        {!products?.length ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
            Er staan nog geen producten live. Kom later terug.
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li key={p.slug}>
                <ProductCard
                  name={p.name}
                  slug={p.slug}
                  priceCents={p.price_cents}
                  imagePath={pickPrimaryImagePath(p.product_images as any)}
                  excerpt={excerpt(p.description)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
