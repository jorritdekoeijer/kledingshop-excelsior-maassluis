import Link from "next/link";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";
import { ProductCard } from "@/components/shop/ProductCard";
import { pickPrimaryImagePath } from "@/lib/shop/product-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function excerpt(text: string | null, max = 100) {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: featured } = await supabase
    .from("products")
    .select("name,slug,price_cents,description,product_images(path,is_primary,sort_order)")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-red">Excelsior Maassluis</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-brand-blue sm:text-4xl">
            Clubkleding en artikelen voor leden en supporters
          </h1>
          <p className="mt-4 max-w-xl text-lg text-zinc-600">
            Bestel eenvoudig officiële kleding en merchandise. Alles wat je nodig hebt om Excelsior te dragen — met
            kwaliteit en clubgevoel.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-md bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a91416]"
            >
              Bekijk het assortiment
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50"
            >
              Inloggen voor staf
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-brand-blue">Uitgelicht</h2>
            <p className="mt-1 text-sm text-zinc-600">Een selectie uit ons assortiment.</p>
          </div>
          <Link href="/shop" className="text-sm font-medium text-brand-blue hover:underline">
            Alles bekijken
          </Link>
        </div>

        {!featured?.length ? (
          <p className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-600">
            Nog geen producten beschikbaar. Zodra er artikelen live staan, verschijnen ze hier.
          </p>
        ) : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
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

        <section className="mt-16 rounded-xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-brand-blue">Waarom bij ons bestellen?</h2>
          <ul className="mt-4 grid gap-3 text-sm text-zinc-700 sm:grid-cols-3">
            <li className="rounded-lg bg-white p-4 shadow-sm">
              <span className="font-medium text-brand-blue">Officieel</span>
              <p className="mt-1 text-zinc-600">Artikelen in clubstijl, rechtstreeks voor Excelsior.</p>
            </li>
            <li className="rounded-lg bg-white p-4 shadow-sm">
              <span className="font-medium text-brand-blue">Overzichtelijk</span>
              <p className="mt-1 text-zinc-600">Duidelijke prijzen en productinformatie.</p>
            </li>
            <li className="rounded-lg bg-white p-4 shadow-sm">
              <span className="font-medium text-brand-blue">Leden & staf</span>
              <p className="mt-1 text-zinc-600">Publieke shop; inloggen voor staf en beheer.</p>
            </li>
          </ul>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
