"use client";

import { useMemo, useState, useTransition } from "react";
import { consumeStock } from "@/app/dashboard/stock/actions";
import type { ProductPickOption, VariantSegment } from "@/lib/stock/product-pick-types";

function defaultSegmentForProduct(p: ProductPickOption | undefined): VariantSegment {
  if (!p) return "adult";
  const y = p.youth.sizes.length;
  const a = p.adult.sizes.length;
  if (y > 0 && a === 0) return "youth";
  if (a > 0 && y === 0) return "adult";
  return "adult";
}

function sizesForSegment(p: ProductPickOption, seg: VariantSegment): string[] {
  return seg === "youth" ? p.youth.sizes : p.adult.sizes;
}

function modelForSegment(p: ProductPickOption, seg: VariantSegment): string {
  return seg === "youth" ? p.youth.modelNumber : p.adult.modelNumber;
}

export function ConsumeStockForm({ products }: { products: ProductPickOption[] }) {
  const [productId, setProductId] = useState("");
  const [useLegacy, setUseLegacy] = useState(false);
  const [segment, setSegment] = useState<VariantSegment>("adult");
  const [sizeLabel, setSizeLabel] = useState("");
  const [pending, startTransition] = useTransition();

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const p = productId ? productMap.get(productId) : undefined;

  const sizeOptions = useMemo(() => {
    if (!p || useLegacy) return [];
    return sizesForSegment(p, segment);
  }, [p, useLegacy, segment]);

  function applyProduct(nextProductId: string) {
    setProductId(nextProductId);
    const np = nextProductId ? productMap.get(nextProductId) : undefined;
    const def = defaultSegmentForProduct(np);
    setSegment(def);
    setUseLegacy(false);
    const sizes = np ? sizesForSegment(np, def) : [];
    setSizeLabel(sizes[0] ?? "");
  }

  function onSegmentChange(next: VariantSegment) {
    setSegment(next);
    const sizes = p ? sizesForSegment(p, next) : [];
    setSizeLabel(sizes[0] ?? "");
  }

  const showToggle = Boolean(p && p.youth.sizes.length > 0 && p.adult.sizes.length > 0 && !useLegacy);
  const model = p && !useLegacy ? modelForSegment(p, segment) : "";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (useLegacy) {
      fd.set("variantMode", "legacy");
      fd.set("sizeLabel", "");
    } else {
      fd.set("variantMode", segment);
      fd.set("sizeLabel", sizeLabel.trim());
    }
    startTransition(() => {
      void consumeStock(fd);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <label className="block">
        <span className="text-sm text-zinc-700">Product</span>
        <select
          name="productId"
          required
          value={productId}
          onChange={(e) => applyProduct(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">— Kies product —</option>
          {products.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-md border border-zinc-200 bg-zinc-50/80 p-3">
        <p className="text-xs font-medium text-zinc-600">Voorraadsoort</p>
        <div className="mt-2 space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="stockKind"
              checked={!useLegacy}
              onChange={() => {
                setUseLegacy(false);
                if (p) {
                  const def = defaultSegmentForProduct(p);
                  setSegment(def);
                  const sizes = sizesForSegment(p, def);
                  setSizeLabel(sizes[0] ?? "");
                }
              }}
              className="h-4 w-4"
            />
            <span>Jeugd (YOUTH) / Volwassenen (ADULT) — modelnummer en maat</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="stockKind"
              checked={useLegacy}
              onChange={() => {
                setUseLegacy(true);
                setSizeLabel("");
              }}
              className="h-4 w-4"
            />
            <span>Legacy: voorraad zonder jeugd/volwassen-label (alleen als die regels bestaan)</span>
          </label>
        </div>

        {p && !useLegacy ? (
          <div className="mt-3 space-y-2">
            {showToggle ? (
              <div
                className="inline-flex rounded-full border border-zinc-300 bg-white p-1"
                role="group"
                aria-label="Jeugd of volwassenen"
              >
                <button
                  type="button"
                  onClick={() => onSegmentChange("youth")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    segment === "youth" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  YOUTH
                </button>
                <button
                  type="button"
                  onClick={() => onSegmentChange("adult")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    segment === "adult" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  ADULT
                </button>
              </div>
            ) : (
              <p className="text-xs font-medium text-zinc-700">
                {segment === "youth" ? "Jeugd (YOUTH)" : "Volwassenen (ADULT)"}
              </p>
            )}
            {model ? (
              <p className="text-xs text-zinc-500">
                Model: <span className="font-mono text-zinc-800">{model}</span>
              </p>
            ) : null}

            <label className="block">
              <span className="text-sm text-zinc-700">Maat</span>
              {sizeOptions.length > 0 ? (
                <select
                  value={sizeLabel}
                  onChange={(e) => setSizeLabel(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  required
                >
                  {sizeOptions.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={sizeLabel}
                  onChange={(e) => setSizeLabel(e.target.value)}
                  placeholder="Bv. onesize"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              )}
            </label>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-sm text-zinc-700">Aantal</span>
          <input
            name="quantity"
            defaultValue="1"
            min={1}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Reden</span>
          <input
            name="reason"
            defaultValue="sale"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <button
        className="rounded-md bg-brand-red px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        type="submit"
        disabled={pending || !productId}
      >
        {pending ? "Bezig…" : "Verbruik"}
      </button>
    </form>
  );
}
