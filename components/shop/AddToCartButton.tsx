"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/shop/cart/CartContext";

type Props = {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
};

export function AddToCartButton({ productId, name, slug, priceCents }: Props) {
  const { addLine } = useCart();
  const [done, setDone] = useState(false);

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => {
          addLine({ lineId: productId, productId, name, slug, priceCents, quantity: 1 });
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        }}
        className="inline-flex min-h-[44px] items-center justify-center rounded-none bg-brand-blue px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
      >
        In winkelmand
      </button>
      {done ? <span className="text-sm text-green-700">Toegevoegd</span> : null}
      <Link href="/cart" className="text-sm font-medium text-brand-blue underline-offset-4 hover:underline">
        Naar winkelmand
      </Link>
    </div>
  );
}
