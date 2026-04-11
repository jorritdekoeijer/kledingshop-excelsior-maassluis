import Link from "next/link";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";

type Props = {
  name: string;
  slug: string;
  priceCents: number;
  imagePath: string | null;
  excerpt?: string | null;
};

export function ProductCard({ name, slug, priceCents, imagePath, excerpt }: Props) {
  const img = getPublicProductImageUrl(imagePath);
  const price = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(priceCents / 100);

  return (
    <Link
      href={`/shop/${slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:border-brand-blue/30 hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full bg-zinc-100">
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
        <p className="mt-auto pt-3 text-sm font-semibold text-zinc-900">{price}</p>
      </div>
    </Link>
  );
}
