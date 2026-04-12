import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";
import { ProductCard } from "@/components/shop/ProductCard";
import { ShopSearchBar } from "@/components/shop/ShopSearchBar";
import { shopDisplayPricing } from "@/lib/shop/display-pricing";
import { pickPrimaryImagePath } from "@/lib/shop/product-images";
import { PUBLIC_PRODUCT_CATEGORIES_TABLE } from "@/lib/db/public-tables";
import { normalizeSearchQuery } from "@/lib/shop/search";
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

export default async function ShopPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp.c;
  const categorySlug = typeof raw === "string" ? raw : undefined;
  const searchRaw = sp.q;
  const search = normalizeSearchQuery(typeof searchRaw === "string" ? searchRaw : undefined);

  const supabase = await createSupabaseServerClient();

  let categoryId: string | null = null;
  let categoryName: string | null = null;
  if (categorySlug) {
    const { data: cat } = await supabase.from(PUBLIC_PRODUCT_CATEGORIES_TABLE).select("id,name").eq("slug", categorySlug).maybeSingle();
    if (cat) {
      categoryId = cat.id;
      categoryName = cat.name;
    }
  }

  let q = supabase
    .from("products")
    .select("name,slug,price_cents,temporary_discount_percent,description,product_images(path,is_primary,sort_order)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (categoryId) {
    q = q.eq("category_id", categoryId);
  }

  if (search) {
    const pat = `%${search.replace(/"/g, "")}%`;
    q = q.or(`name.ilike."${pat}",description.ilike."${pat}"`);
  }

  const { data: products } = await q;

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-black">Assortiment</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {categoryName ? `Categorie: ${categoryName}` : "Alle actieve producten."}
              {search ? (
                <>
                  {" "}
                  · Zoekopdracht: <span className="font-medium text-zinc-800">&quot;{search}&quot;</span>
                </>
              ) : null}
            </p>
            <div className="mt-4">
              <ShopSearchBar categorySlug={categorySlug} defaultQuery={search ?? ""} />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-4 text-sm">
            {categorySlug ? (
              <Link href="/shop" className="font-medium text-brand-blue hover:underline">
                Alle categorieën
              </Link>
            ) : null}
            <Link href="/" className="text-brand-blue hover:underline">
              ← Terug naar home
            </Link>
          </div>
        </div>

        {!products?.length ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
            {categorySlug && !categoryId
              ? "Deze categorie bestaat niet of er zijn geen producten."
              : search
                ? "Geen producten gevonden voor deze zoekopdracht. Pas je zoekterm aan of wis het veld."
                : "Er staan nog geen producten live. Kom later terug."}
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const pr = shopDisplayPricing(p);
              return (
                <li key={p.slug}>
                  <ProductCard
                    name={p.name}
                    slug={p.slug}
                    priceCents={pr.effectiveCents}
                    compareAtCents={pr.showExtraDiscount ? pr.originalCents : null}
                    showExtraDiscount={pr.showExtraDiscount}
                    imagePath={pickPrimaryImagePath(p.product_images as any)}
                    excerpt={excerpt(p.description)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
