import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";
import { orderedImagePaths, type ProductImageRow } from "@/lib/shop/product-images";
import { shopDisplayPricing } from "@/lib/shop/display-pricing";
import { normalizeProductDetails, normalizeVariantBlock } from "@/lib/shop/product-json";
import { effectivePriceCents } from "@/lib/products/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ProductImageGallery } from "@/components/shop/ProductImageGallery";

type Props = { params: Promise<{ slug: string }> };

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("products").select("name").eq("slug", slug).eq("active", true).maybeSingle();
  if (!data) return { title: "Product" };
  return { title: `${data.name} | Kledingshop Excelsior Maassluis` };
}

function VariantPriceLines({
  label,
  origCents,
  discountPercent
}: {
  label: string;
  origCents: number;
  discountPercent: number;
}) {
  const eff = effectivePriceCents(origCents, discountPercent);
  const strike = discountPercent > 0 && eff < origCents;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="min-w-[8rem] text-sm font-medium text-zinc-700">{label}</span>
      <div className="flex flex-wrap items-baseline gap-2">
        {strike ? <span className="text-sm text-zinc-400 line-through">{eur(origCents)}</span> : null}
        <span className="text-xl font-semibold text-zinc-900">{eur(eff)}</span>
        <span className="text-xs text-zinc-500">incl. btw</span>
      </div>
    </div>
  );
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

  const youthSale = youth.sale_cents != null && youth.sale_cents >= 0 ? youth.sale_cents : null;
  const adultSale = adult.sale_cents != null && adult.sale_cents >= 0 ? adult.sale_cents : null;

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

            <div className="mt-4 space-y-3">
              {youthSale != null ? (
                <VariantPriceLines label="Jeugd (YOUTH)" origCents={youthSale} discountPercent={pct} />
              ) : null}
              {adultSale != null ? (
                <VariantPriceLines label="Volwassenen (ADULT)" origCents={adultSale} discountPercent={pct} />
              ) : null}
              {youthSale == null && adultSale == null ? (
                <div className="flex flex-wrap items-baseline gap-3">
                  {pricing.showExtraDiscount ? (
                    <span className="text-lg text-zinc-400 line-through">{eur(pricing.originalCents)}</span>
                  ) : null}
                  <span className="text-2xl font-semibold text-zinc-900">{eur(pricing.effectiveCents)}</span>
                  <span className="text-sm text-zinc-500">incl. btw</span>
                </div>
              ) : null}
            </div>

            <div className="mt-8">
              <AddToCartButton
                productId={product.id}
                name={product.name}
                slug={product.slug}
                priceCents={pricing.effectiveCents}
              />
              <p className="mt-4 text-sm text-zinc-500">
                Geen account nodig — je betaalt veilig via Mollie (bijv. iDEAL).
              </p>
            </div>

            {(youth.sizes?.length ?? 0) > 0 || (adult.sizes?.length ?? 0) > 0 ? (
              <div className="mt-10 border-t border-zinc-200 pt-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-900">Maten</h2>
                <dl className="mt-4 space-y-3 text-sm text-zinc-700">
                  {(youth.sizes?.length ?? 0) > 0 ? (
                    <div>
                      <dt className="font-medium text-zinc-900">Jeugd (YOUTH)</dt>
                      <dd className="mt-1">{youth.sizes?.join(", ")}</dd>
                    </div>
                  ) : null}
                  {(adult.sizes?.length ?? 0) > 0 ? (
                    <div>
                      <dt className="font-medium text-zinc-900">Volwassenen (ADULT)</dt>
                      <dd className="mt-1">{adult.sizes?.join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl border-t border-zinc-200 pt-10">
          {product.description ? (
            <details className="group border-b border-zinc-200" open>
              <summary className="cursor-pointer list-none py-3 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  Productbeschrijving
                  <span className="text-zinc-400 transition group-open:rotate-180">▼</span>
                </span>
              </summary>
              <div className="prose prose-sm max-w-none pb-4 text-zinc-700">
                <p className="whitespace-pre-wrap">{product.description}</p>
              </div>
            </details>
          ) : null}

          {details.length > 0 ? (
            <details className="group border-b border-zinc-200" open={!product.description}>
              <summary className="cursor-pointer list-none py-3 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  Productdetails
                  <span className="text-zinc-400 transition group-open:rotate-180">▼</span>
                </span>
              </summary>
              <ul className="space-y-2 pb-4 text-sm text-zinc-700">
                {details.map((row, i) => (
                  <li key={`${row.label}-${i}`}>
                    <span className="font-medium text-zinc-900">{row.label}:</span> {row.value}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
