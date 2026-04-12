"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/shop/cart/CartContext";
import { effectivePriceCents } from "@/lib/products/pricing";
import type { ProductVariantBlock } from "@/lib/validation/products";

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

type Props = {
  productId: string;
  name: string;
  slug: string;
  discountPercent: number;
  youth: ProductVariantBlock;
  adult: ProductVariantBlock;
  fallbackEffectiveCents: number;
};

export function ProductPurchasePanel({
  productId,
  name,
  slug,
  discountPercent,
  youth,
  adult,
  fallbackEffectiveCents
}: Props) {
  const { addLine } = useCart();
  const [done, setDone] = useState(false);

  const pct = discountPercent;

  const youthSale = youth.sale_cents != null && youth.sale_cents >= 0 ? youth.sale_cents : null;
  const adultSale = adult.sale_cents != null && adult.sale_cents >= 0 ? adult.sale_cents : null;
  const hasY = youthSale != null;
  const hasA = adultSale != null;

  const initialSegment = useMemo((): "youth" | "adult" | null => {
    if (hasY && hasA) return "adult";
    if (hasY && !hasA) return "youth";
    if (!hasY && hasA) return "adult";
    return null;
  }, [hasY, hasA]);

  const [segment, setSegment] = useState<"youth" | "adult" | null>(initialSegment);

  useEffect(() => {
    setSegment(initialSegment);
  }, [initialSegment]);

  const currentBlock = segment === "youth" ? youth : segment === "adult" ? adult : null;
  const sizes = useMemo(() => {
    if (segment === "youth") return youth.sizes ?? [];
    if (segment === "adult") return adult.sizes ?? [];
    const merged = [...new Set([...(youth.sizes ?? []), ...(adult.sizes ?? [])])];
    return merged;
  }, [segment, youth.sizes, adult.sizes]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSize(null);
  }, [segment, productId]);

  const displayCents = useMemo(() => {
    if (segment === "youth" && youthSale != null) return effectivePriceCents(youthSale, pct);
    if (segment === "adult" && adultSale != null) return effectivePriceCents(adultSale, pct);
    return fallbackEffectiveCents;
  }, [segment, youthSale, adultSale, pct, fallbackEffectiveCents]);

  const needSize = sizes.length > 0;
  const canAdd = !needSize || (selectedSize != null && selectedSize.length > 0);

  function buildLine() {
    if (segment === "youth" || segment === "adult") {
      const sz = selectedSize ?? "";
      const lineId = `${productId}:${segment}:${sz}`;
      const label =
        segment === "youth"
          ? `${name} · Jeugd (YOUTH)${sz ? ` · ${sz}` : ""}`
          : `${name} · Volwassenen (ADULT)${sz ? ` · ${sz}` : ""}`;
      return {
        lineId,
        productId,
        name: label,
        slug,
        priceCents: displayCents,
        variant: segment as "youth" | "adult",
        sizeLabel: sz || undefined
      };
    }
    const sz = selectedSize ?? "";
    const lineId = `${productId}:st:${sz}`;
    const label = `${name}${sz ? ` · ${sz}` : ""}`;
    return {
      lineId,
      productId,
      name: label,
      slug,
      priceCents: displayCents,
      sizeLabel: sz || undefined
    };
  }

  return (
    <div className="mt-4 space-y-6">
      {hasY && hasA ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Variant</p>
          <div
            className="mt-2 inline-flex rounded-full border border-zinc-300 bg-zinc-50 p-1"
            role="group"
            aria-label="Kies Jeugd of Volwassenen"
          >
            <button
              type="button"
              onClick={() => setSegment("youth")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                segment === "youth" ? "bg-brand-blue text-white shadow" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              YOUTH
            </button>
            <button
              type="button"
              onClick={() => setSegment("adult")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                segment === "adult" ? "bg-brand-blue text-white shadow" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              ADULT
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Verkoopprijs incl. btw</p>
        <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-zinc-900">{eur(displayCents)}</p>
      </div>

      {sizes.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-zinc-800">Maat</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((sz) => {
              const on = selectedSize === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`min-h-[44px] min-w-[3rem] rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                    on
                      ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                      : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
                  }`}
                >
                  {sz}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => {
            if (!canAdd) return;
            const line = buildLine();
            addLine({ ...line, quantity: 1 });
            setDone(true);
            window.setTimeout(() => setDone(false), 2200);
          }}
          className="flex w-full min-h-[52px] items-center justify-center rounded-lg bg-brand-blue px-6 text-base font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Toevoegen aan winkelwagen
        </button>
        {done ? <p className="text-center text-sm font-medium text-green-700">Toegevoegd</p> : null}
        <p className="text-center">
          <Link href="/cart" className="text-sm font-medium text-brand-blue underline-offset-4 hover:underline">
            Naar winkelwagen
          </Link>
        </p>
      </div>
    </div>
  );
}
