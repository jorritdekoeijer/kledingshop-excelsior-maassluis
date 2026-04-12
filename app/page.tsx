import Link from "next/link";

/** Geen statische snapshot met lege homepage bij build — logo/banner komen uit DB. */
export const dynamic = "force-dynamic";
import { AnnouncementBar } from "@/components/shop/AnnouncementBar";
import { CompactProductCard } from "@/components/shop/CompactProductCard";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";
import { HOMEPAGE_FALLBACK, loadHomepageSettings } from "@/lib/homepage/load-public";
import { shopDisplayPricing } from "@/lib/shop/display-pricing";
import { pickPrimaryImagePath } from "@/lib/shop/product-images";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Zelfde kleuren als eerder: `from-brand-blue via-[#061a40] to-zinc-900` */
const HERO_GRADIENT_FALLBACK = {
  from: "#04235a",
  via: "#061a40",
  to: "#18181b"
} as const;

const DEFAULT_FALLBACK_TILES: { title: string; href: string }[] = [
  { title: "Clubcollectie", href: "/shop" },
  { title: "Trainingskleding", href: "/shop" },
  { title: "Accessoires", href: "/shop" },
  { title: "Fans & supporters", href: "/shop" }
];

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const hp = await loadHomepageSettings();

  const { data: productRows } = await supabase
    .from("products")
    .select("name,slug,price_cents,temporary_discount_percent,description,created_at,category_id,product_images(path,is_primary,sort_order)")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(24);

  const products = productRows ?? [];
  const featuredPrimary = products.slice(0, 6);
  const featuredSecondary = products.slice(6, 12);
  const moreProducts = products.slice(12, 18);

  const tileCategoryIds = hp.tiles.map((t) => t.categoryId).filter((id): id is string => !!id);
  let tileCategoryRows: { id: string; name: string; slug: string }[] = [];
  if (tileCategoryIds.length > 0) {
    const { data } = await supabase.from("categories").select("id,name,slug").in("id", tileCategoryIds);
    tileCategoryRows = data ?? [];
  }
  const tileCatMap = new Map(tileCategoryRows.map((c) => [c.id, c]));

  const coverByCategory = new Map<string, string | null>();
  if (products.length) {
    for (const p of products) {
      const cid = p.category_id as string | null;
      if (cid && !coverByCategory.has(cid)) {
        coverByCategory.set(cid, pickPrimaryImagePath(p.product_images as any));
      }
    }
  }

  const collectionTiles = [0, 1, 2, 3].map((idx) => {
    const t = hp.tiles[idx];
    const cat = t?.categoryId ? tileCatMap.get(t.categoryId) : null;
    const fallback = DEFAULT_FALLBACK_TILES[idx] ?? DEFAULT_FALLBACK_TILES[0];
    const title = cat?.name ?? fallback.title;
    const href = cat ? `/shop?c=${encodeURIComponent(cat.slug)}` : fallback.href;
    let imagePath: string | null = t?.imagePath ?? null;
    if (!imagePath && cat?.id) imagePath = coverByCategory.get(cat.id) ?? null;
    return { title, href, imagePath, key: `home-tile-${idx}` };
  });

  const videoId = process.env.NEXT_PUBLIC_YOUTUBE_VIDEO_ID?.trim();

  const fb = HOMEPAGE_FALLBACK;
  const announcementLines = [
    { text: hp.bannerLine1.trim() || fb.bannerLines[0], enabled: hp.bannerEnabled1 },
    { text: hp.bannerLine2.trim() || fb.bannerLines[1], enabled: hp.bannerEnabled2 },
    { text: hp.bannerLine3.trim() || fb.bannerLines[2], enabled: hp.bannerEnabled3 }
  ];

  const heroTitle = hp.heroTitle.trim() || fb.heroTitle;
  const heroSubtitle = hp.heroSubtitle.trim() || fb.heroSubtitle;
  const heroBannerUrl = getPublicProductImageUrl(hp.heroBannerPath ?? null);
  const gradMid = hp.heroGradientMidStopPercent;
  const heroOverlayGradient = `linear-gradient(to bottom right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.55) ${gradMid}%, rgba(0,0,0,0.8) 100%)`;
  const heroFallbackGradient = `linear-gradient(to bottom right, ${HERO_GRADIENT_FALLBACK.from} 0%, ${HERO_GRADIENT_FALLBACK.via} ${gradMid}%, ${HERO_GRADIENT_FALLBACK.to} 100%)`;

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <AnnouncementBar lines={announcementLines} />
      <PublicHeader />

      <section className="relative isolate min-h-[min(70vh,560px)] w-full overflow-hidden bg-zinc-900">
        {heroBannerUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroBannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: heroOverlayGradient }} aria-hidden />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: heroFallbackGradient }} aria-hidden />
            <div
              className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.35'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
              }}
              aria-hidden
            />
          </>
        )}
        <Link
          href="/shop"
          className="absolute inset-0 z-0"
          aria-label="Ga naar het assortiment"
        />
        <div className="relative z-[1] mx-auto flex h-full min-h-[min(70vh,560px)] max-w-[1800px] items-end justify-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16">
          <div className="max-w-md text-right text-white drop-shadow-md">
            <h1 className="whitespace-pre-line text-3xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              {heroTitle}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/90 sm:text-base">{heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap items-center justify-end">
              <Link
                href="/shop"
                className="inline-flex min-h-[44px] items-center justify-center rounded-none bg-brand-blue px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Naar het assortiment
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1800px] px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {collectionTiles.map((tile) => (
            <CollectionTile
              key={tile.key}
              title={tile.title}
              href={tile.href}
              imagePath={tile.imagePath}
            />
          ))}
        </div>
      </section>

      <ProductSection
        id="uitgelicht"
        title="Uitgelicht uit het assortiment"
        products={featuredPrimary}
        viewAllHref="/shop"
      />

      {featuredSecondary.length > 0 ? (
        <div className="bg-[#f3f3f3]">
          <ProductSection
            id="meer"
            title="Meer voor jouw clublook"
            products={featuredSecondary}
            viewAllHref="/shop"
            muted
          />
        </div>
      ) : null}

      {moreProducts.length > 0 ? (
        <ProductSection
          id="meer-producten"
          title="Nog meer uit de shop"
          products={moreProducts}
          viewAllHref="/shop"
        />
      ) : null}

      <section className="mx-auto grid max-w-[1800px] gap-5 px-4 pb-12 sm:grid-cols-2 sm:px-6">
        <PromoCard
          href="/shop"
          title="Supporter in stijl"
          subtitle="Bekijk de clubcollectie"
          buttonText="Naar de shop"
          className="min-h-[280px] md:min-h-[360px] lg:min-h-[400px]"
          tone="light"
        />
        <PromoCard
          href="/shop"
          title="Excelsior Maassluis"
          subtitle="Artikelen rechtstreeks voor jouw vereniging"
          buttonText="Ontdek producten"
          className="min-h-[280px] md:min-h-[360px] lg:min-h-[400px]"
          tone="blue"
        />
      </section>

      <section className="bg-brand-red text-white">
        <div className="mx-auto grid max-w-[2100px] items-center gap-8 px-4 py-10 md:grid-cols-[1fr_min(40%,480px)] md:gap-12 md:px-6 md:py-12">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Blijf op de hoogte</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/95 sm:text-base">
              Volg Excelsior Maassluis via de officiële clubkanalen voor nieuws over wedstrijden, evenementen en
              nieuwe artikelen in deze shop.
            </p>
            <p className="mt-4 text-sm text-white/90">
              Vragen over je bestelling? Neem contact op met de kledingcommissie via de club.
            </p>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden bg-black/20">
            <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-white/80">
              <span className="rounded border border-white/30 px-4 py-3">Clubfoto of banner kan hier later geplaatst worden</span>
            </div>
          </div>
        </div>
      </section>

      <section id="over-de-shop" className="mx-auto max-w-[1800px] px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-center text-2xl font-semibold text-brand-blue sm:text-3xl">
          <strong>Kledingshop Excelsior Maassluis</strong>
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-center text-base leading-relaxed text-[#1f1f1f]">
          Welkom in de officiële kledingshop van Excelsior Maassluis. Hier bestel je clubkleding en artikelen voor op
          en naast het veld. Iedereen kan bestellen: leden, supporters en staf — zonder account. Alleen medewerkers van
          de kledingcommissie loggen in voor het beheer van producten, voorraad en bestellingen.
        </p>
      </section>

      {videoId ? (
        <section className="bg-zinc-950">
          <div className="relative mx-auto aspect-video max-h-[70vh] w-full max-w-[1800px]">
            <iframe
              title="Excelsior video"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}

      <PublicFooter />
    </div>
  );
}

function CollectionTile({
  title,
  href,
  imagePath
}: {
  title: string;
  href: string;
  imagePath: string | null;
}) {
  const url = getPublicProductImageUrl(imagePath);
  return (
    <Link
      href={href}
      className="group relative block aspect-square overflow-hidden bg-zinc-100 shadow-sm ring-1 ring-black/5 transition hover:ring-brand-blue/30"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-100 p-4 text-center">
          <span className="text-sm font-medium text-zinc-600">{title}</span>
        </div>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-4 pt-16 text-center">
        <span className="text-sm font-medium uppercase tracking-wide text-white drop-shadow">{title}</span>
      </span>
    </Link>
  );
}

function ProductSection({
  id,
  title,
  products,
  viewAllHref,
  muted
}: {
  id: string;
  title: string;
  products: {
    name: string;
    slug: string;
    price_cents: number;
    temporary_discount_percent?: number | null;
    product_images: unknown;
  }[];
  viewAllHref: string;
  muted?: boolean;
}) {
  if (!products.length) return null;
  return (
    <section id={id} className={muted ? "py-10 sm:py-14" : "bg-white py-10 sm:py-14"}>
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-black sm:text-2xl">{title}</h2>
          <Link
            href={viewAllHref}
            className="rounded-none border border-zinc-900 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-900 transition hover:bg-zinc-900 hover:text-white"
          >
            Alles bekijken
          </Link>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {products.map((p) => {
            const pr = shopDisplayPricing(p);
            return (
              <li key={p.slug}>
                <CompactProductCard
                  name={p.name}
                  slug={p.slug}
                  priceCents={pr.effectiveCents}
                  compareAtCents={pr.showExtraDiscount ? pr.originalCents : null}
                  showExtraDiscount={pr.showExtraDiscount}
                  imagePath={pickPrimaryImagePath(p.product_images as any)}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function PromoCard({
  href,
  title,
  subtitle,
  buttonText,
  tone,
  className
}: {
  href: string;
  title: string;
  subtitle: string;
  buttonText: string;
  tone: "light" | "blue";
  className?: string;
}) {
  const bg =
    tone === "light"
      ? "bg-gradient-to-br from-zinc-300 via-zinc-200 to-zinc-100"
      : "bg-gradient-to-br from-brand-blue via-[#06275c] to-[#021631]";
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-end overflow-hidden p-6 text-white ${bg} ${className ?? ""}`}
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%23fff%22%20fill-opacity%3D%220.06%22%3E%3Cpath%20d%3D%22M20%2020h20v20H20zM0%200h20v20H0z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
      <div className="relative z-[1]">
        {tone === "light" ? (
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-800">Shop</p>
        ) : (
          <p className="text-sm font-medium uppercase tracking-widest text-white/90">Seizoen</p>
        )}
        <h3 className={`mt-2 text-2xl font-semibold leading-tight ${tone === "light" ? "text-zinc-900" : "text-white"}`}>
          {title}
        </h3>
        <p className={`mt-2 max-w-sm text-sm ${tone === "light" ? "text-zinc-700" : "text-white/90"}`}>{subtitle}</p>
        <span
          className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-none px-5 py-2.5 text-sm font-semibold transition ${
            tone === "light"
              ? "bg-white text-black hover:bg-zinc-100"
              : "bg-white text-brand-blue hover:bg-zinc-100"
          }`}
        >
          {buttonText}
        </span>
      </div>
    </Link>
  );
}
