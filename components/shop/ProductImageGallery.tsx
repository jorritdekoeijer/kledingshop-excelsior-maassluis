"use client";

import { useState } from "react";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";

type Props = {
  paths: string[];
  productName: string;
};

export function ProductImageGallery({ paths, productName }: Props) {
  const urls = paths.map(getPublicProductImageUrl).filter((u): u is string => Boolean(u));
  const [ix, setIx] = useState(0);

  if (urls.length === 0) {
    return <div className="flex aspect-square items-center justify-center text-sm text-zinc-400">Geen foto</div>;
  }

  const main = urls[ix] ?? urls[0];

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={main}
          alt={productName}
          className="aspect-square w-full object-cover"
        />
      </div>
      {urls.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" role="list">
          {urls.map((u, i) => (
            <li key={u + String(i)} className="shrink-0">
              <button
                type="button"
                onClick={() => setIx(i)}
                className={`block overflow-hidden rounded-md border-2 bg-white transition ${
                  i === ix ? "border-brand-blue ring-1 ring-brand-blue/30" : "border-zinc-200 hover:border-zinc-400"
                }`}
                aria-label={`Foto ${i + 1}`}
                aria-current={i === ix ? true : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-16 w-16 object-cover sm:h-20 sm:w-20" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
