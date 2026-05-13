import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";
import { ProductPurchasePanel } from "@/components/shop/ProductPurchasePanel";
import { SetProductPurchasePanel, type SetComponentForShop } from "@/components/shop/SetProductPurchasePanel";
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
      "id,name,slug,price_cents,is_set,temporary_discount_percent,description,product_details,garment_type,allow_jersey_number,jersey_number_sale_cents,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize,product_images(path,is_primary,sort_order)"
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
  const socks = normalizeVariantBlock((product as any).variant_socks);
  const shoes = normalizeVariantBlock((product as any).variant_shoes);
  const onesize = normalizeVariantBlock((product as any).variant_onesize);
  const pct = Number(product.temporary_discount_percent ?? 0);
  const isSet = Boolean((product as any).is_set ?? false);

  let setComponents: SetComponentForShop[] = [];
  if (isSet) {
    const firstQ = await supabase
      .from("product_set_components")
      .select(
        "component_product_id,quantity,sort_order,option_group,option_group_label,component:component_product_id(id,name,slug,garment_type,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize)"
      )
      .eq("set_product_id", product.id)
      .order("sort_order", { ascending: true });
    let compRows: any[] | null = null;
    if (firstQ.error) {
      const code = String((firstQ.error as any)?.code ?? "");
      const msg = String((firstQ.error as any)?.message ?? "").toLowerCase();
      if (code === "42703" || msg.includes("option_group_label")) {
        const second = await supabase
          .from("product_set_components")
          .select(
            "component_product_id,quantity,sort_order,option_group,component:component_product_id(id,name,slug,garment_type,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize)"
          )
          .eq("set_product_id", product.id)
          .order("sort_order", { ascending: true });
        if (second.error) {
          const c2 = String((second.error as any)?.code ?? "");
          const m2 = String((second.error as any)?.message ?? "").toLowerCase();
          if (c2 === "42703" || m2.includes("option_group")) {
            const fb = await supabase
              .from("product_set_components")
              .select(
                "component_product_id,quantity,sort_order,component:component_product_id(id,name,slug,garment_type,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize)"
              )
              .eq("set_product_id", product.id)
              .order("sort_order", { ascending: true });
            compRows = (fb.data ?? []).map((r: any) => ({
              ...r,
              option_group: null,
              option_group_label: null
            }));
          }
        } else {
          compRows = (second.data ?? []).map((r: any) => ({ ...r, option_group_label: null }));
        }
      } else if (code === "42703" || msg.includes("option_group")) {
        const fb = await supabase
          .from("product_set_components")
          .select(
            "component_product_id,quantity,sort_order,component:component_product_id(id,name,slug,garment_type,variant_youth,variant_adult,variant_socks,variant_shoes,variant_onesize)"
          )
          .eq("set_product_id", product.id)
          .order("sort_order", { ascending: true });
        compRows = (fb.data ?? []).map((r: any) => ({
          ...r,
          option_group: null,
          option_group_label: null
        }));
      }
    } else {
      compRows = firstQ.data ?? [];
    }
    setComponents = (compRows ?? [])
      .map((row: any) => {
        const cp = row.component;
        if (!cp) return null;
        return {
          componentProductId: cp.id as string,
          componentSlug: cp.slug as string,
          componentName: cp.name as string,
          quantity: Number(row.quantity ?? 1),
          optionGroup:
            typeof row.option_group === "string" && row.option_group.trim().length > 0
              ? row.option_group.trim()
              : null,
          optionGroupLabel:
            typeof row.option_group_label === "string" && row.option_group_label.trim().length > 0
              ? row.option_group_label.trim()
              : null,
          garmentType: (cp.garment_type ?? "clothing") as
            | "clothing"
            | "socks"
            | "shoes"
            | "onesize",
          youth: normalizeVariantBlock(cp.variant_youth),
          adult: normalizeVariantBlock(cp.variant_adult),
          socks: normalizeVariantBlock(cp.variant_socks),
          shoes: normalizeVariantBlock(cp.variant_shoes),
          onesize: normalizeVariantBlock(cp.variant_onesize)
        } satisfies SetComponentForShop;
      })
      .filter((x): x is SetComponentForShop => x !== null);
  }

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

            {isSet ? (
              <SetProductPurchasePanel
                setProductId={product.id}
                setName={product.name}
                setSlug={product.slug}
                setSalePriceInclCents={Number(product.price_cents ?? 0)}
                components={setComponents}
              />
            ) : (
              <ProductPurchasePanel
                productId={product.id}
                name={product.name}
                slug={product.slug}
                discountPercent={pct}
                garmentType={product.garment_type as any}
                allowJerseyNumber={Boolean((product as any).allow_jersey_number ?? false)}
                jerseyNumberSaleCents={Number((product as any).jersey_number_sale_cents ?? 0)}
                youth={youth}
                adult={adult}
                socks={socks}
                shoes={shoes}
                onesize={onesize}
                fallbackEffectiveCents={pricing.effectiveCents}
              />
            )}

            {product.description ? (
              <section className="mt-10">
                <h2 className="text-lg font-semibold text-zinc-900">Productomschrijving</h2>
                <div className="prose prose-sm mt-3 max-w-none text-zinc-700">
                  <p className="whitespace-pre-wrap">{product.description}</p>
                </div>
              </section>
            ) : null}

            {details.length > 0 ? (
              <section className={product.description ? "mt-8" : "mt-10"}>
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
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
