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
  /** Optionele keuzegroep (interne key): items met dezelfde groep zijn alternatieven (klant kiest één). */
  optionGroup: string | null;
  /** Optioneel publiek label voor de keuzegroep (wordt boven de keuze getoond). */
  optionGroupLabel: string | null;
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

type GroupBucket = { key: string; items: { component: SetComponentForShop; index: number }[] };

/**
 * Bepaal de weergavevolgorde:
 * - Componenten zonder option_group worden los gerenderd (eigen bucket per index)
 * - Componenten met option_group worden gegroepeerd per groepnaam
 *
 * We bewaren de originele volgorde door per bucket de eerste index als sorteerwaarde te gebruiken.
 */
function buildBuckets(components: SetComponentForShop[]): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>();
  components.forEach((c, i) => {
    const key = c.optionGroup ? `g:${c.optionGroup}` : `i:${i}`;
    const existing = buckets.get(key);
    if (existing) existing.items.push({ component: c, index: i });
    else buckets.set(key, { key, items: [{ component: c, index: i }] });
  });
  return [...buckets.values()].sort((a, b) => a.items[0].index - b.items[0].index);
}

export function SetProductPurchasePanel({
  setProductId,
  setName,
  setSlug,
  setSalePriceInclCents,
  components
}: Props) {
  const { addLine } = useCart();
  const [done, setDone] = useState(false);

  const buckets = useMemo(() => buildBuckets(components), [components]);

  const [choices, setChoices] = useState<ComponentChoice[]>(() =>
    components.map((c) => ({ segment: initialSegment(c), sizeLabel: null }))
  );

  // Per option-group: welke component-index is geselecteerd? Standaard de eerste van de groep.
  const [groupSelection, setGroupSelection] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const b of buckets) {
      if (b.items.length > 1) init[b.key] = b.items[0].index;
    }
    return init;
  });

  function isComponentActive(index: number): boolean {
    const bucket = buckets.find((b) => b.items.some((it) => it.index === index));
    if (!bucket) return true;
    if (bucket.items.length <= 1) return true;
    return groupSelection[bucket.key] === index;
  }

  const sizesByComponent = useMemo(
    () => components.map((c, i) => sizesFor(c, choices[i]?.segment ?? null)),
    [components, choices]
  );

  const allComplete = components.every((_, i) => {
    if (!isComponentActive(i)) return true;
    const need = sizesByComponent[i].length > 0;
    const ch = choices[i];
    if (!ch) return false;
    if (need && !ch.sizeLabel) return false;
    return true;
  });

  function buildLine() {
    const componentLines = components
      .map((c, i) => {
        if (!isComponentActive(i)) return null;
        const ch = choices[i] ?? { segment: null, sizeLabel: null };
        return {
          productId: c.componentProductId,
          slug: c.componentSlug,
          name: c.componentName,
          quantity: c.quantity,
          variant: ch.segment ?? undefined,
          sizeLabel: ch.sizeLabel ?? undefined
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
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
        {buckets.map((bucket) => {
          const isChoice = bucket.items.length > 1;
          const groupLabel = isChoice ? bucket.key.replace(/^g:/, "") : null;

          if (!isChoice) {
            const only = bucket.items[0];
            return (
              <ComponentRow
                key={bucket.key}
                component={only.component}
                index={only.index}
                disabled={false}
                choice={choices[only.index] ?? { segment: null, sizeLabel: null }}
                sizes={sizesByComponent[only.index] ?? []}
                onSegmentChange={(seg) => {
                  const next = [...choices];
                  next[only.index] = { segment: seg, sizeLabel: null };
                  setChoices(next);
                }}
                onSizeChange={(sz) => {
                  const next = [...choices];
                  next[only.index] = { ...(next[only.index] ?? { segment: null, sizeLabel: null }), sizeLabel: sz };
                  setChoices(next);
                }}
              />
            );
          }

          const activeIndex = groupSelection[bucket.key] ?? bucket.items[0].index;
          // Gebruik het publieke label als één van de regels in de groep het heeft ingevuld.
          const publicLabel = bucket.items
            .map((it) => it.component.optionGroupLabel)
            .find((l): l is string => Boolean(l && l.trim().length > 0));
          const heading = publicLabel ?? "Kies één";
          void groupLabel;
          return (
            <div key={bucket.key} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">{heading}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {bucket.items.map((it) => {
                  const selected = activeIndex === it.index;
                  return (
                    <button
                      type="button"
                      key={it.index}
                      onClick={() => setGroupSelection((s) => ({ ...s, [bucket.key]: it.index }))}
                      className={`rounded-md border-2 px-3 py-2 text-left text-sm font-medium transition ${
                        selected
                          ? "border-brand-blue bg-brand-blue/5 text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                            selected ? "border-brand-blue bg-brand-blue" : "border-zinc-400 bg-white"
                          }`}
                          aria-hidden
                        >
                          {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                        </span>
                        <span>
                          {it.component.quantity > 1 ? `${it.component.quantity}× ` : ""}
                          {it.component.componentName}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-4">
                {bucket.items.map((it) => {
                  const isSelected = activeIndex === it.index;
                  return (
                    <ComponentRow
                      key={it.index}
                      component={it.component}
                      index={it.index}
                      disabled={!isSelected}
                      choice={choices[it.index] ?? { segment: null, sizeLabel: null }}
                      sizes={sizesByComponent[it.index] ?? []}
                      onSegmentChange={(seg) => {
                        if (!isSelected) return;
                        const next = [...choices];
                        next[it.index] = { segment: seg, sizeLabel: null };
                        setChoices(next);
                      }}
                      onSizeChange={(sz) => {
                        if (!isSelected) return;
                        const next = [...choices];
                        next[it.index] = {
                          ...(next[it.index] ?? { segment: null, sizeLabel: null }),
                          sizeLabel: sz
                        };
                        setChoices(next);
                      }}
                    />
                  );
                })}
              </div>
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

function ComponentRow({
  component: c,
  disabled,
  choice,
  sizes,
  onSegmentChange,
  onSizeChange
}: {
  component: SetComponentForShop;
  index: number;
  disabled: boolean;
  choice: ComponentChoice;
  sizes: string[];
  onSegmentChange: (seg: ComponentChoice["segment"]) => void;
  onSizeChange: (sz: string) => void;
}) {
  const hasY = c.youth.sale_cents != null && c.youth.sale_cents >= 0;
  const hasA = c.adult.sale_cents != null && c.adult.sale_cents >= 0;
  const showSegmentToggle = c.garmentType === "clothing" && hasY && hasA;
  const greyClasses = disabled ? "opacity-50" : "";
  return (
    <div className={`rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 ${greyClasses}`} aria-disabled={disabled}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">
          {c.quantity > 1 ? `${c.quantity}× ` : ""}
          {c.componentName}
        </p>
        {disabled ? <span className="text-xs text-zinc-500">Niet gekozen</span> : null}
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
              disabled={disabled}
              onClick={() => onSegmentChange("youth")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                choice.segment === "youth" ? "bg-brand-blue text-white shadow" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              YOUTH
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSegmentChange("adult")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                choice.segment === "adult" ? "bg-brand-blue text-white shadow" : "text-zinc-700 hover:bg-zinc-100"
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
              const on = choice.sizeLabel === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSizeChange(sz)}
                  className={`min-h-[40px] min-w-[2.75rem] rounded-md border-2 px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
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
}
