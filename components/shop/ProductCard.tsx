import Link from "next/link";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";

type Props = {
  name: string;
  slug: string;
  priceCents: number;
  /** Oorspronkelijke prijs incl. btw vóór tijdelijke korting (voor doorstrepen). */
  compareAtCents?: number | null;
  showExtraDiscount?: boolean;
  imagePath: string | null;
  excerpt?: string | null;
};

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

export function ProductCard({
  name,
  slug,
  priceCents,
  compareAtCents,
  showExtraDiscount,
  imagePath,
  excerpt
}: Props) {
  const img = getPublicProductImageUrl(imagePath);
  const price = eur(priceCents);
  const compare =
    compareAtCents != null && compareAtCents > priceCents ? eur(compareAtCents) : null;

  return (
    <Link
      href={`/shop/${slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:border-brand-blue/30 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full bg-zinc-100">
        {showExtraDiscount ? (
          <span className="absolute left-2 top-2 z-[1] rounded bg-brand-blue px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">
            EXTRA KORTING
          </span>
        ) : null}
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">Geen foto</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-medium text-brand-blue group-hover:underline">{name}</h3>
        {excerpt ? <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{excerpt}</p> : null}
        <p className="mt-auto pt-3 text-sm font-semibold text-zinc-900">
          {compare ? (
            <>
              <span className="mr-2 text-zinc-400 line-through">{compare}</span>
              <span className="text-brand-red">{price}</span>
            </>
          ) : (
            price
          )}
        </p>
      </div>
    </Link>
  );
}
