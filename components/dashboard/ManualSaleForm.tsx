"use client";

import { useMemo, useState, useTransition } from "react";
import { createManualSaleAction } from "@/app/dashboard/stock/handmatige-verkoop/actions";

import type { ProductPickOption, VariantSegment } from "@/lib/stock/product-pick-types";

export type ManualSaleProductMeta = {
  id: string;
  name: string;
  isSet: boolean;
  setPriceInclCents: number;
};

export type ManualSaleSetComponentDef = {
  setProductId: string;
  componentProductId: string;
  quantity: number;
  sortOrder: number;
};

type ComponentChoice = {
  componentProductId: string;
  quantityPerSet: number;
  segment: VariantSegment;
  sizeLabel: string;
};

type LineState = {
  key: string;
  productId: string;
  isSet: boolean;
  segment: VariantSegment;
  sizeLabel: string;
  quantity: number;
  components: ComponentChoice[];
};

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

function mkKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
}

function emptyLine(): LineState {
  return { key: mkKey(), productId: "", isSet: false, segment: "adult", sizeLabel: "", quantity: 1, components: [] };
}

function defaultSegmentForProduct(p: ProductPickOption | undefined): VariantSegment {
  if (!p) return "adult";
  const o = p.onesize?.sizes.length ?? 0;
  if (o > 0) return "onesize";
  const h = p.shoes?.sizes.length ?? 0;
  if (h > 0) return "shoes";
  const s = p.socks?.sizes.length ?? 0;
  if (s > 0) return "socks";
  const y = p.youth.sizes.length;
  const a = p.adult.sizes.length;
  if (y > 0 && a === 0) return "youth";
  if (a > 0 && y === 0) return "adult";
  return "adult";
}

function sizesForSegment(p: ProductPickOption, seg: VariantSegment): string[] {
  if (seg === "youth") return p.youth.sizes;
  if (seg === "adult") return p.adult.sizes;
  if (seg === "socks") return p.socks?.sizes ?? [];
  if (seg === "onesize") return p.onesize?.sizes ?? [];
  return p.shoes?.sizes ?? [];
}

export function ManualSaleForm({
  products,
  productMeta,
  setComponentDefs
}: {
  products: ProductPickOption[];
  productMeta: ManualSaleProductMeta[];
  setComponentDefs: ManualSaleSetComponentDef[];
}) {
  const [saleDate, setSaleDate] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineState[]>(() => [emptyLine()]);
  const [pending, startTransition] = useTransition();

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const metaMap = useMemo(() => new Map(productMeta.map((m) => [m.id, m])), [productMeta]);
  const componentsBySetId = useMemo(() => {
    const m = new Map<string, ManualSaleSetComponentDef[]>();
    for (const d of setComponentDefs) {
      const arr = m.get(d.setProductId) ?? [];
      arr.push(d);
      m.set(d.setProductId, arr);
    }
    return m;
  }, [setComponentDefs]);

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function onProductChange(key: string, productId: string) {
    if (!productId) {
      updateLine(key, { productId: "", isSet: false, segment: "adult", sizeLabel: "", components: [] });
      return;
    }
    const meta = metaMap.get(productId);
    if (meta?.isSet) {
      const defs = componentsBySetId.get(productId) ?? [];
      const initialComponents: ComponentChoice[] = defs.map((d) => {
        const cp = productMap.get(d.componentProductId);
        const seg = defaultSegmentForProduct(cp);
        const sizes = cp ? sizesForSegment(cp, seg) : [];
        return {
          componentProductId: d.componentProductId,
          quantityPerSet: d.quantity,
          segment: seg,
          sizeLabel: sizes[0] ?? ""
        };
      });
      updateLine(key, { productId, isSet: true, segment: "adult", sizeLabel: "", components: initialComponents });
      return;
    }
    const p = productMap.get(productId);
    const seg = defaultSegmentForProduct(p);
    const sizes = p ? sizesForSegment(p, seg) : [];
    updateLine(key, { productId, isSet: false, segment: seg, sizeLabel: sizes[0] ?? "", components: [] });
  }

  function onSegmentChange(key: string, productId: string, seg: VariantSegment) {
    const p = productId ? productMap.get(productId) : undefined;
    if (!p) return;
    const sizes = sizesForSegment(p, seg);
    updateLine(key, { segment: seg, sizeLabel: sizes[0] ?? "" });
  }

  function updateComponent(
    lineKey: string,
    componentIdx: number,
    patch: Partial<ComponentChoice>
  ) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== lineKey) return l;
        const next = [...l.components];
        next[componentIdx] = { ...next[componentIdx], ...patch };
        return { ...l, components: next };
      })
    );
  }

  function unitRevenueFor(line: LineState): number {
    if (line.isSet) {
      const m = metaMap.get(line.productId);
      return Math.max(0, m?.setPriceInclCents ?? 0);
    }
    const p = productMap.get(line.productId);
    if (!p) return 0;
    // Pak verkoopprijs van het gekozen variant-blok via de pick options is niet direct beschikbaar;
    // we lezen 0 — server vult dit later correct in als 0 wordt gestuurd (fallback via product).
    return 0;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    type OutLine = {
      productId: string;
      isSet: boolean;
      variantSegment?: VariantSegment;
      sizeLabel?: string;
      quantity: number;
      unitRevenueInclCents: number;
      components?: { componentProductId: string; variantSegment: VariantSegment; sizeLabel: string; quantityPerSet: number }[];
    };
    const outLines: OutLine[] = [];

    for (const l of lines) {
      if (!l.productId) continue;
      if (l.quantity < 1) {
        alert("Aantal moet minstens 1 zijn.");
        return;
      }
      if (l.isSet) {
        if (l.components.length === 0) {
          alert("Setregel heeft geen componenten. Kies een ander product of verwijder de regel.");
          return;
        }
        for (const c of l.components) {
          if (!c.sizeLabel.trim()) {
            alert("Kies per component een maat.");
            return;
          }
        }
        outLines.push({
          productId: l.productId,
          isSet: true,
          quantity: l.quantity,
          unitRevenueInclCents: unitRevenueFor(l),
          components: l.components.map((c) => ({
            componentProductId: c.componentProductId,
            variantSegment: c.segment,
            sizeLabel: c.sizeLabel.trim(),
            quantityPerSet: c.quantityPerSet
          }))
        });
      } else {
        if (!l.sizeLabel.trim()) {
          alert("Kies per regel een maat.");
          return;
        }
        outLines.push({
          productId: l.productId,
          isSet: false,
          variantSegment: l.segment,
          sizeLabel: l.sizeLabel.trim(),
          quantity: l.quantity,
          unitRevenueInclCents: 0
        });
      }
    }

    if (!saleDate.trim()) {
      alert("Datum is verplicht.");
      return;
    }
    if (outLines.length === 0) {
      alert("Voeg minstens één regel toe.");
      return;
    }

    startTransition(() => {
      createManualSaleAction({
        saleDate: saleDate.trim(),
        note: note.trim(),
        lines: outLines
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Datum verkoop</span>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Opmerking (optioneel)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Bijv. Verkocht via andere webshop"
          />
        </label>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Regels</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Bij opslaan wordt voorraad FIFO afgeboekt (reden: handmatige verkoop). Set-producten boeken per component af.
        </p>

        <div className="mt-4 space-y-4">
          {lines.map((line) => {
            const meta = line.productId ? metaMap.get(line.productId) : undefined;
            const p = line.productId ? productMap.get(line.productId) : undefined;
            const sizes = p && !line.isSet ? sizesForSegment(p, line.segment) : [];
            const hasShoes = Boolean(p && (p.shoes?.sizes.length ?? 0) > 0);
            const hasSocks = Boolean(p && (p.socks?.sizes.length ?? 0) > 0);
            const hasOne = Boolean(p && (p.onesize?.sizes.length ?? 0) > 0);
            const showToggle = Boolean(
              p && !hasShoes && !hasSocks && !hasOne && p.youth.sizes.length > 0 && p.adult.sizes.length > 0
            );

            return (
              <div key={line.key} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                <div className="grid gap-3 md:grid-cols-12 md:items-end">
                  <label className="md:col-span-1">
                    <span className="text-xs font-medium text-zinc-600">Aantal</span>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                    />
                  </label>

                  <label className="md:col-span-5">
                    <span className="text-xs font-medium text-zinc-600">Product</span>
                    <select
                      value={line.productId}
                      onChange={(e) => onProductChange(line.key, e.target.value)}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                    >
                      <option value="">— Kies product —</option>
                      {products.map((pr) => {
                        const m = metaMap.get(pr.id);
                        return (
                          <option key={pr.id} value={pr.id}>
                            {m?.isSet ? "[SET] " : ""}
                            {pr.name}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  {!line.isSet ? (
                    <>
                      <div className="md:col-span-3">
                        <span className="text-xs font-medium text-zinc-600">Variant</span>
                        {!line.productId ? (
                          <p className="mt-2 text-xs text-zinc-400">Kies eerst een product</p>
                        ) : hasOne ? (
                          <p className="mt-2 text-xs font-semibold text-zinc-700">ONE SIZE</p>
                        ) : hasShoes ? (
                          <p className="mt-2 text-xs font-semibold text-zinc-700">SHOES</p>
                        ) : hasSocks ? (
                          <p className="mt-2 text-xs font-semibold text-zinc-700">SOCKS</p>
                        ) : showToggle ? (
                          <div className="mt-2 inline-flex rounded-full border border-zinc-300 bg-white p-1" role="group">
                            <button
                              type="button"
                              onClick={() => onSegmentChange(line.key, line.productId, "youth")}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                line.segment === "youth" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
                              }`}
                            >
                              YOUTH
                            </button>
                            <button
                              type="button"
                              onClick={() => onSegmentChange(line.key, line.productId, "adult")}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                line.segment === "adult" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
                              }`}
                            >
                              ADULT
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs font-medium text-zinc-700">
                            {line.segment === "youth"
                              ? "Jeugd (YOUTH)"
                              : line.segment === "adult"
                                ? "Volwassenen (ADULT)"
                                : line.segment === "socks"
                                  ? "SOCKS"
                                  : line.segment === "shoes"
                                    ? "SHOES"
                                    : "ONE SIZE"}
                          </p>
                        )}
                      </div>

                      <label className="md:col-span-2">
                        <span className="text-xs font-medium text-zinc-600">Maat</span>
                        {!line.productId ? (
                          <select
                            disabled
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-zinc-100 px-2 py-2 text-sm"
                          >
                            <option value="">—</option>
                          </select>
                        ) : (
                          <select
                            value={line.sizeLabel}
                            onChange={(e) => updateLine(line.key, { sizeLabel: e.target.value })}
                            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                          >
                            {sizes.map((sz) => (
                              <option key={sz} value={sz}>
                                {sz}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>
                    </>
                  ) : (
                    <div className="md:col-span-5 text-xs text-zinc-700">
                      Setprijs:{" "}
                      <span className="font-semibold tabular-nums">
                        {eur(meta?.setPriceInclCents ?? 0)}
                      </span>{" "}
                      · {line.components.length} {line.components.length === 1 ? "component" : "componenten"}
                    </div>
                  )}

                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Verwijder
                    </button>
                  </div>
                </div>

                {line.isSet && line.components.length > 0 ? (
                  <div className="mt-4 space-y-2 rounded-md border border-zinc-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Componenten</p>
                    {line.components.map((c, idx) => {
                      const cp = productMap.get(c.componentProductId);
                      if (!cp) return (
                        <p key={idx} className="text-xs text-red-700">
                          Component {c.componentProductId} niet beschikbaar.
                        </p>
                      );
                      const cHasOne = (cp.onesize?.sizes.length ?? 0) > 0;
                      const cHasShoes = (cp.shoes?.sizes.length ?? 0) > 0;
                      const cHasSocks = (cp.socks?.sizes.length ?? 0) > 0;
                      const cShowToggle = !cHasOne && !cHasShoes && !cHasSocks && cp.youth.sizes.length > 0 && cp.adult.sizes.length > 0;
                      const cSizes = sizesForSegment(cp, c.segment);
                      return (
                        <div key={idx} className="grid items-end gap-3 md:grid-cols-12">
                          <div className="md:col-span-5 text-sm text-zinc-800">
                            <span className="font-medium">
                              {c.quantityPerSet > 1 ? `${c.quantityPerSet}× ` : ""}
                              {cp.name}
                            </span>
                          </div>
                          <div className="md:col-span-4">
                            <span className="text-xs font-medium text-zinc-600">Variant</span>
                            {cHasOne ? (
                              <p className="mt-1 text-xs font-semibold text-zinc-700">ONE SIZE</p>
                            ) : cHasShoes ? (
                              <p className="mt-1 text-xs font-semibold text-zinc-700">SHOES</p>
                            ) : cHasSocks ? (
                              <p className="mt-1 text-xs font-semibold text-zinc-700">SOCKS</p>
                            ) : cShowToggle ? (
                              <div className="mt-1 inline-flex rounded-full border border-zinc-300 bg-white p-1" role="group">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sizes = sizesForSegment(cp, "youth");
                                    updateComponent(line.key, idx, { segment: "youth", sizeLabel: sizes[0] ?? "" });
                                  }}
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    c.segment === "youth" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
                                  }`}
                                >
                                  YOUTH
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const sizes = sizesForSegment(cp, "adult");
                                    updateComponent(line.key, idx, { segment: "adult", sizeLabel: sizes[0] ?? "" });
                                  }}
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    c.segment === "adult" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
                                  }`}
                                >
                                  ADULT
                                </button>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs font-medium text-zinc-700">
                                {c.segment === "youth"
                                  ? "YOUTH"
                                  : c.segment === "adult"
                                    ? "ADULT"
                                    : c.segment === "socks"
                                      ? "SOCKS"
                                      : c.segment === "shoes"
                                        ? "SHOES"
                                        : "ONE SIZE"}
                              </p>
                            )}
                          </div>
                          <label className="md:col-span-3">
                            <span className="text-xs font-medium text-zinc-600">Maat</span>
                            <select
                              value={c.sizeLabel}
                              onChange={(e) => updateComponent(line.key, idx, { sizeLabel: e.target.value })}
                              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                            >
                              {cSizes.length === 0 ? <option value="">—</option> : null}
                              {cSizes.map((sz) => (
                                <option key={sz} value={sz}>
                                  {sz}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addLine}
          className="mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          + Regel toevoegen
        </button>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Opslaan…" : "Opslaan"}
      </button>
    </form>
  );
}
