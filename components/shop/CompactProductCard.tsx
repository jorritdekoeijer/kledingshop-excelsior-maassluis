import Link from "next/link";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";

type Props = {
  name: string;
  slug: string;
  priceCents: number;
  imagePath: string | null;
};

export function CompactProductCard({ name, slug, priceCents, imagePath }: Props) {
  const img = getPublicProductImageUrl(imagePath);
  const price = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(priceCents / 100);

  return (
    <Link href={`/shop/${slug}`} className="group block">
      <div className="relative overflow-hidden bg-[#f1f5f9]">
        <div className="aspect-[3/4] w-full">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt=""
              className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-400">Geen foto</div>
          )}
        </div>
      </div>
      <div className="mt-3 text-center">
        <div className="line-clamp-2 text-sm font-normal leading-snug text-black group-hover:underline">{name}</div>
        <div className="mt-1 text-sm font-medium text-brand-red">{price}</div>
      </div>
    </Link>
  );
}
