"use client";

import { useMemo, useState, useTransition } from "react";
import { createManualSaleAction } from "@/app/dashboard/stock/handmatige-verkoop/actions";

import type { ProductPickOption, VariantSegment } from "@/lib/stock/product-pick-types";

type LineState = {
  key: string;
  productId: string;
  segment: VariantSegment;
  sizeLabel: string;
  quantity: number;
};

function mkKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
}

function emptyLine(): LineState {
  return { key: mkKey(), productId: "", segment: "adult", sizeLabel: "", quantity: 1 };
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

export function ManualSaleForm({ products }: { products: ProductPickOption[] }) {
  const [saleDate, setSaleDate] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineState[]>(() => [emptyLine()]);
  const [pending, startTransition] = useTransition();

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

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
    const p = productId ? productMap.get(productId) : undefined;
    const seg = defaultSegmentForProduct(p);
    const sizes = p ? sizesForSegment(p, seg) : [];
    updateLine(key, { productId, segment: seg, sizeLabel: sizes[0] ?? "" });
  }

  function onSegmentChange(key: string, productId: string, seg: VariantSegment) {
    const p = productId ? productMap.get(productId) : undefined;
    if (!p) return;
    const sizes = sizesForSegment(p, seg);
    updateLine(key, { segment: seg, sizeLabel: sizes[0] ?? "" });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const outLines: { productId: string; variantSegment: VariantSegment; quantity: number; sizeLabel: string }[] = [];
    for (const l of lines) {
      if (!l.productId) continue;
      if (!l.sizeLabel.trim()) {
        alert("Kies per regel een maat.");
        return;
      }
      if (l.quantity < 1) {
        alert("Aantal moet minstens 1 zijn.");
        return;
      }
      outLines.push({
        productId: l.productId,
        variantSegment: l.segment,
        quantity: l.quantity,
        sizeLabel: l.sizeLabel.trim()
      });
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
        <p className="mt-1 text-xs text-zinc-500">Bij opslaan wordt voorraad FIFO afgeboekt (reden: handmatige verkoop).</p>

        <div className="mt-4 space-y-4">
          {lines.map((line) => {
            const p = line.productId ? productMap.get(line.productId) : undefined;
            const sizes = p ? sizesForSegment(p, line.segment) : [];
            const hasShoes = Boolean(p && (p.shoes?.sizes.length ?? 0) > 0);
            const hasSocks = Boolean(p && (p.socks?.sizes.length ?? 0) > 0);
            const hasOne = Boolean(p && (p.onesize?.sizes.length ?? 0) > 0);
            const showToggle = Boolean(
              p && !hasShoes && !hasSocks && !hasOne && p.youth.sizes.length > 0 && p.adult.sizes.length > 0
            );

            return (
              <div key={line.key} className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 md:grid-cols-12 md:items-end">
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
                    {products.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                  </select>
                </label>

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
                    <select disabled className="mt-1 w-full rounded-md border border-zinc-300 bg-zinc-100 px-2 py-2 text-sm">
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

