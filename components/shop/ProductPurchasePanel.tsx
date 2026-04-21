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
  garmentType: "clothing" | "socks" | "shoes" | "onesize";
  allowJerseyNumber?: boolean;
  jerseyNumberSaleCents?: number;
  youth: ProductVariantBlock;
  adult: ProductVariantBlock;
  socks: ProductVariantBlock;
  shoes: ProductVariantBlock;
  onesize: ProductVariantBlock;
  fallbackEffectiveCents: number;
};

export function ProductPurchasePanel({
  productId,
  name,
  slug,
  discountPercent,
  garmentType,
  allowJerseyNumber,
  jerseyNumberSaleCents,
  youth,
  adult,
  socks,
  shoes,
  onesize,
  fallbackEffectiveCents
}: Props) {
  const { addLine } = useCart();
  const [done, setDone] = useState(false);

  const pct = discountPercent;

  const youthSale = youth.sale_cents != null && youth.sale_cents >= 0 ? youth.sale_cents : null;
  const adultSale = adult.sale_cents != null && adult.sale_cents >= 0 ? adult.sale_cents : null;
  const socksSale = socks.sale_cents != null && socks.sale_cents >= 0 ? socks.sale_cents : null;
  const shoesSale = shoes.sale_cents != null && shoes.sale_cents >= 0 ? shoes.sale_cents : null;
  const onesizeSale = onesize.sale_cents != null && onesize.sale_cents >= 0 ? onesize.sale_cents : null;
  const hasY = youthSale != null;
  const hasA = adultSale != null;

  const initialSegment = useMemo((): "youth" | "adult" | "socks" | "shoes" | null => {
    if (garmentType === "socks") return "socks";
    if (garmentType === "shoes") return "shoes";
    if (garmentType === "onesize") return null;
    if (hasY && hasA) return "adult";
    if (hasY && !hasA) return "youth";
    if (!hasY && hasA) return "adult";
    return null;
  }, [garmentType, hasY, hasA]);

  const [segment, setSegment] = useState<"youth" | "adult" | "socks" | "shoes" | null>(initialSegment);

  useEffect(() => {
    setSegment(initialSegment);
  }, [initialSegment]);

  const sizes = useMemo(() => {
    if (garmentType === "onesize") return onesize.sizes ?? [];
    if (segment === "youth") return youth.sizes ?? [];
    if (segment === "adult") return adult.sizes ?? [];
    if (segment === "socks") return socks.sizes ?? [];
    if (segment === "shoes") return shoes.sizes ?? [];
    const merged = [...new Set([...(youth.sizes ?? []), ...(adult.sizes ?? [])])];
    return merged;
  }, [segment, garmentType, youth.sizes, adult.sizes, socks.sizes, shoes.sizes, onesize.sizes]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSize(null);
  }, [segment, productId]);

  const displayCents = useMemo(() => {
    if (garmentType === "onesize" && onesizeSale != null) return effectivePriceCents(onesizeSale, pct);
    if (segment === "youth" && youthSale != null) return effectivePriceCents(youthSale, pct);
    if (segment === "adult" && adultSale != null) return effectivePriceCents(adultSale, pct);
    if (segment === "socks" && socksSale != null) return effectivePriceCents(socksSale, pct);
    if (segment === "shoes" && shoesSale != null) return effectivePriceCents(shoesSale, pct);
    return fallbackEffectiveCents;
  }, [segment, garmentType, youthSale, adultSale, socksSale, shoesSale, onesizeSale, pct, fallbackEffectiveCents]);

  const needSize = sizes.length > 0;
  const canAdd = !needSize || (selectedSize != null && selectedSize.length > 0);

  const jerseyEnabled = garmentType === "clothing" && Boolean(allowJerseyNumber) && Number(jerseyNumberSaleCents ?? 0) > 0;
  const [addJersey, setAddJersey] = useState(false);
  const [jerseyNumber, setJerseyNumber] = useState("");
  const jerseyOk = !jerseyEnabled || !addJersey || /^\d{1,3}$/.test(jerseyNumber.trim());
  const canAddFinal = canAdd && jerseyOk && (!jerseyEnabled || !addJersey || jerseyNumber.trim().length > 0);

  function buildLine() {
    const jersey = jerseyEnabled && addJersey ? jerseyNumber.trim() : "";
    const jerseySale = jerseyEnabled && addJersey ? Math.max(0, Number(jerseyNumberSaleCents ?? 0)) : 0;
    const jerseyLabel = jersey ? ` · Rugnummer ${jersey}` : "";
    if (garmentType === "onesize") {
      const sz = selectedSize ?? "";
      const lineId = `${productId}:onesize:${sz}:${jersey}`;
      const label = `${name}${sz ? ` · ${sz}` : ""}${jerseyLabel}`;
      return {
        lineId,
        productId,
        name: label,
        slug,
        priceCents: displayCents + jerseySale,
        variant: "onesize" as const,
        sizeLabel: sz || undefined,
        jerseyNumber: jersey || undefined
      };
    }
    if (segment === "youth" || segment === "adult") {
      const sz = selectedSize ?? "";
      const lineId = `${productId}:${segment}:${sz}:${jersey}`;
      const label =
        segment === "youth"
          ? `${name} · Jeugd (YOUTH)${sz ? ` · ${sz}` : ""}`
          : `${name} · Volwassenen (ADULT)${sz ? ` · ${sz}` : ""}`;
      return {
        lineId,
        productId,
        name: `${label}${jerseyLabel}`,
        slug,
        priceCents: displayCents + jerseySale,
        variant: segment as "youth" | "adult",
        sizeLabel: sz || undefined,
        jerseyNumber: jersey || undefined
      };
    }
    if (segment === "socks" || segment === "shoes") {
      const sz = selectedSize ?? "";
      const lineId = `${productId}:${segment}:${sz}`;
      const label = `${name} · ${segment.toUpperCase()}${sz ? ` · ${sz}` : ""}`;
      return {
        lineId,
        productId,
        name: label,
        slug,
        priceCents: displayCents,
        variant: segment,
        sizeLabel: sz || undefined
      };
    }
    const sz = selectedSize ?? "";
    const lineId = `${productId}:st:${sz}:${jersey}`;
    const label = `${name}${sz ? ` · ${sz}` : ""}${jerseyLabel}`;
    return {
      lineId,
      productId,
      name: label,
      slug,
      priceCents: displayCents + jerseySale,
      sizeLabel: sz || undefined,
      jerseyNumber: jersey || undefined
    };
  }

  return (
    <div className="mt-4 space-y-6">
      {garmentType === "clothing" && hasY && hasA ? (
        <div>
          <div
            className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 p-1"
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

      {jerseyEnabled ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-900">
            <input
              type="checkbox"
              checked={addJersey}
              onChange={(e) => {
                setAddJersey(e.target.checked);
                if (!e.target.checked) setJerseyNumber("");
              }}
              className="h-4 w-4 border-zinc-300 text-brand-blue focus:ring-brand-blue/40"
            />
            Rugnummer toevoegen
          </label>
          {addJersey ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Rugnummer</span>
                <input
                  value={jerseyNumber}
                  onChange={(e) => setJerseyNumber(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-32 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold"
                  placeholder="bijv. 10"
                />
              </label>
              <div className="text-sm text-zinc-700">
                + {eur(Math.max(0, Number(jerseyNumberSaleCents ?? 0)))}
              </div>
              {!jerseyOk ? <p className="w-full text-sm text-red-700">Vul een geldig rugnummer in.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          disabled={!canAddFinal}
          onClick={() => {
            if (!canAddFinal) return;
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
