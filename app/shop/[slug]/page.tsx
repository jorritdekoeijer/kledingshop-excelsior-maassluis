import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";
import { pickPrimaryImagePath } from "@/lib/shop/product-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";

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
    .select("name,slug,price_cents,description,product_images(path,is_primary,sort_order)")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!product) notFound();

  const primary = pickPrimaryImagePath(product.product_images as any);
  const hero = getPublicProductImageUrl(primary);
  const price = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(product.price_cents / 100);

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/shop" className="text-sm text-brand-blue hover:underline">
          ← Terug naar assortiment
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center text-sm text-zinc-400">Geen foto</div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-brand-blue">{product.name}</h1>
            <p className="mt-3 text-2xl font-semibold text-zinc-900">{price}</p>
            {product.description ? (
              <div className="prose prose-sm mt-6 max-w-none text-zinc-700">
                <p className="whitespace-pre-wrap">{product.description}</p>
              </div>
            ) : null}
            <p className="mt-8 text-sm text-zinc-500">
              Bestellen volgt in een volgende stap (winkelmand + betaling). Daarvoor hoef je geen account aan te maken.
            </p>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
