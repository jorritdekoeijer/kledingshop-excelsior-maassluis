import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";
import { ProductPurchasePanel } from "@/components/shop/ProductPurchasePanel";
import { orderedImagePaths, type ProductImageRow } from "@/lib/shop/product-images";
import { shopDisplayPricing } from "@/lib/shop/display-pricing";
import { normalizeProductDetails, normalizeVariantBlock } from "@/lib/shop/product-json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductImageGallery } from "@/components/shop/ProductImageGallery";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("products").select("name").eq("slug", slug).eq("active", true).maybeSingle();
  if (!data) return { title: "Product" };
  return { title: `${data.name} | Kledingshop Excelsior Maassluis` };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      "id,name,slug,price_cents,temporary_discount_percent,description,product_details,variant_youth,variant_adult,product_images(path,is_primary,sort_order)"
    )
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!product) notFound();

  const imagePaths = orderedImagePaths(product.product_images as ProductImageRow[] | null);
  const pricing = shopDisplayPricing(product);
  const details = normalizeProductDetails(product.product_details);
  const youth = normalizeVariantBlock(product.variant_youth);
  const adult = normalizeVariantBlock(product.variant_adult);
  const pct = Number(product.temporary_discount_percent ?? 0);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <Link href="/shop" className="text-sm text-brand-blue hover:underline">
          ← Terug naar assortiment
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0">
            <ProductImageGallery paths={imagePaths} productName={product.name} />
          </div>

          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-brand-blue sm:text-3xl">{product.name}</h1>

            {pricing.showExtraDiscount ? (
              <p className="mt-3 inline-block rounded bg-brand-blue px-2.5 py-1 text-xs font-bold tracking-wide text-white">
                EXTRA KORTING
              </p>
            ) : null}

            <ProductPurchasePanel
              productId={product.id}
              name={product.name}
              slug={product.slug}
              discountPercent={pct}
              youth={youth}
              adult={adult}
              fallbackEffectiveCents={pricing.effectiveCents}
            />

            <p className="mt-6 text-sm text-zinc-500">
              Geen account nodig — je betaalt veilig via Mollie (bijv. iDEAL).
            </p>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl border-t border-zinc-200 pt-10">
          {product.description ? (
            <section className="mb-10">
              <h2 className="text-lg font-semibold text-zinc-900">Productomschrijving</h2>
              <div className="prose prose-sm mt-3 max-w-none text-zinc-700">
                <p className="whitespace-pre-wrap">{product.description}</p>
              </div>
            </section>
          ) : null}

          {details.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold text-zinc-900">Productdetails</h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                {details.map((row, i) => (
                  <li key={`${row.label}-${i}`}>
                    <span className="font-medium text-zinc-900">{row.label}:</span> {row.value}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
