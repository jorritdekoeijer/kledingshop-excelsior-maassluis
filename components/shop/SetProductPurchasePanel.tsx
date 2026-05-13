"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/shop/cart/CartContext";
import type { ProductVariantBlock } from "@/lib/validation/products";

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

export type SetComponentForShop = {
  componentProductId: string;
  componentSlug: string;
  componentName: string;
  quantity: number;
  garmentType: "clothing" | "socks" | "shoes" | "onesize";
  youth: ProductVariantBlock;
  adult: ProductVariantBlock;
  socks: ProductVariantBlock;
  shoes: ProductVariantBlock;
  onesize: ProductVariantBlock;
};

type Props = {
  setProductId: string;
  setName: string;
  setSlug: string;
  setSalePriceInclCents: number;
  components: SetComponentForShop[];
};

type ComponentChoice = {
  /** Bij clothing met YOUTH+ADULT: door gebruiker gekozen segment. */
  segment: "youth" | "adult" | "socks" | "shoes" | "onesize" | null;
  sizeLabel: string | null;
};

function initialSegment(c: SetComponentForShop): ComponentChoice["segment"] {
  if (c.garmentType === "socks") return "socks";
  if (c.garmentType === "shoes") return "shoes";
  if (c.garmentType === "onesize") return "onesize";
  const hasY = c.youth.sale_cents != null && c.youth.sale_cents >= 0;
  const hasA = c.adult.sale_cents != null && c.adult.sale_cents >= 0;
  if (hasY && hasA) return "adult";
  if (hasY) return "youth";
  if (hasA) return "adult";
  return null;
}

function sizesFor(c: SetComponentForShop, seg: ComponentChoice["segment"]): string[] {
  if (c.garmentType === "onesize") return c.onesize.sizes ?? [];
  if (seg === "youth") return c.youth.sizes ?? [];
  if (seg === "adult") return c.adult.sizes ?? [];
  if (seg === "socks") return c.socks.sizes ?? [];
  if (seg === "shoes") return c.shoes.sizes ?? [];
  return [];
}

export function SetProductPurchasePanel({ setProductId, setName, setSlug, setSalePriceInclCents, components }: Props) {
  const { addLine } = useCart();
  const [done, setDone] = useState(false);

  const [choices, setChoices] = useState<ComponentChoice[]>(() =>
    components.map((c) => ({ segment: initialSegment(c), sizeLabel: null }))
  );

  const sizesByComponent = useMemo(
    () => components.map((c, i) => sizesFor(c, choices[i]?.segment ?? null)),
    [components, choices]
  );

  const allComplete = components.every((_, i) => {
    const need = sizesByComponent[i].length > 0;
    const ch = choices[i];
    if (!ch) return false;
    if (need && !ch.sizeLabel) return false;
    return true;
  });

  function buildLine() {
    const componentLines = components.map((c, i) => {
      const ch = choices[i] ?? { segment: null, sizeLabel: null };
      return {
        productId: c.componentProductId,
        slug: c.componentSlug,
        name: c.componentName,
        quantity: c.quantity,
        variant: ch.segment ?? undefined,
        sizeLabel: ch.sizeLabel ?? undefined
      };
    });
    const lineId = `set:${setProductId}:${componentLines
      .map((cl) => `${cl.productId}|${cl.variant ?? ""}|${cl.sizeLabel ?? ""}|q${cl.quantity}`)
      .join("__")}`;
    return {
      lineId,
      productId: setProductId,
      name: setName,
      slug: setSlug,
      priceCents: setSalePriceInclCents,
      isSet: true as const,
      setComponents: componentLines
    };
  }

  return (
    <div className="mt-4 space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Setprijs incl. btw</p>
        <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-zinc-900">{eur(setSalePriceInclCents)}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Een set bevat {components.length} {components.length === 1 ? "product" : "producten"}. Kies hieronder per
          onderdeel een maat.
        </p>
      </div>

      <div className="space-y-5">
        {components.map((c, i) => {
          const ch = choices[i] ?? { segment: null, sizeLabel: null };
          const hasY = c.youth.sale_cents != null && c.youth.sale_cents >= 0;
          const hasA = c.adult.sale_cents != null && c.adult.sale_cents >= 0;
          const showSegmentToggle = c.garmentType === "clothing" && hasY && hasA;
          const sizes = sizesByComponent[i] ?? [];
          return (
            <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">
                  {c.quantity > 1 ? `${c.quantity}× ` : ""}
                  {c.componentName}
                </p>
              </div>

              {showSegmentToggle ? (
                <div className="mt-3">
                  <div
                    className="inline-flex rounded-full border border-zinc-300 bg-white p-1"
                    role="group"
                    aria-label="Kies Jeugd of Volwassenen"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...choices];
                        next[i] = { segment: "youth", sizeLabel: null };
                        setChoices(next);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        ch.segment === "youth" ? "bg-brand-blue text-white shadow" : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      YOUTH
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...choices];
                        next[i] = { segment: "adult", sizeLabel: null };
                        setChoices(next);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        ch.segment === "adult" ? "bg-brand-blue text-white shadow" : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      ADULT
                    </button>
                  </div>
                </div>
              ) : null}

              {sizes.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-zinc-800">Maat</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sizes.map((sz) => {
                      const on = ch.sizeLabel === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            const next = [...choices];
                            next[i] = { ...ch, sizeLabel: sz };
                            setChoices(next);
                          }}
                          className={`min-h-[40px] min-w-[2.75rem] rounded-md border-2 px-3 py-1.5 text-sm font-semibold transition ${
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
              ) : (
                <p className="mt-2 text-xs text-zinc-600">Geen maatkeuze nodig voor dit onderdeel.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <button
          type="button"
          disabled={!allComplete}
          onClick={() => {
            if (!allComplete) return;
            const line = buildLine();
            addLine({ ...line, quantity: 1 });
            setDone(true);
            window.setTimeout(() => setDone(false), 2200);
          }}
          className="flex w-full min-h-[52px] items-center justify-center rounded-lg bg-brand-blue px-6 text-base font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Set toevoegen aan winkelwagen
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
