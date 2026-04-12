"use client";

import Link from "next/link";
import { useCart } from "@/components/shop/cart/CartContext";

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

export function CartView() {
  const { lines, ready, setQuantity, removeLine, totalQuantity } = useCart();

  if (!ready) {
    return <p className="text-sm text-zinc-500">Laden…</p>;
  }

  if (lines.length === 0 || totalQuantity === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
        <p className="text-sm text-zinc-700">Je winkelmand is leeg.</p>
        <Link href="/shop" className="mt-4 inline-block text-sm font-medium text-brand-blue hover:underline">
          Naar het assortiment
        </Link>
      </div>
    );
  }

  let subtotal = 0;
  for (const l of lines) subtotal += l.priceCents * l.quantity;

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {lines.map((l) => (
          <li key={l.lineId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href={`/shop/${l.slug}`} className="font-medium text-brand-blue hover:underline">
                {l.name}
              </Link>
              <p className="text-sm text-zinc-600">{eur(l.priceCents)} per stuk</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-zinc-600">Aantal</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={l.quantity}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setQuantity(l.lineId, Math.floor(n));
                  }}
                  className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                />
              </label>
              <span className="text-sm font-medium">{eur(l.priceCents * l.quantity)}</span>
              <button
                type="button"
                onClick={() => removeLine(l.lineId)}
                className="text-sm text-red-700 hover:underline"
              >
                Verwijderen
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg font-semibold">Totaal {eur(subtotal)}</p>
        <Link
          href="/checkout"
          className="inline-flex min-h-[44px] items-center justify-center rounded-none bg-brand-blue px-6 py-3 text-sm font-semibold text-white hover:brightness-110"
        >
          Afrekenen
        </Link>
      </div>
    </div>
  );
}
