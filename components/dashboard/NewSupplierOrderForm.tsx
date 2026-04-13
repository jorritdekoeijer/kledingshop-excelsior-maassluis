"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createSupplierOrderAction } from "@/app/dashboard/stock/leveranciersbestelling/nieuw/actions";

type VariantSegment = "youth" | "adult";

type ProductPick = {
  id: string;
  name: string;
  youth: { modelNumber: string; sizes: string[] };
  adult: { modelNumber: string; sizes: string[] };
};

type StockEntry = { productId: string; variantSegment: VariantSegment; sizeLabel: string; qty: number };

export type SupplierOrderSuggestionLine = {
  productId: string;
  productName: string;
  articleCode: string;
  variantSegment: VariantSegment;
  sizeLabel: string;
  currentStock: number;
  thresholdQty: number;
  targetQty: number;
  suggestedQty: number;
};

type LineState = SupplierOrderSuggestionLine & {
  selectedQty: number;
  include: boolean;
};

function buildQtyOptions(min: number): number[] {
  const out = new Set<number>();
  const base = Math.max(1, Math.floor(min));
  out.add(base);
  for (let i = 1; i <= 10; i++) out.add(base + i);
  out.add(base + 25);
  out.add(base + 50);
  out.add(base + 100);
  return [...out].filter((n) => n >= base).sort((a, b) => a - b);
}

export function NewSupplierOrderForm({
  defaultDate,
  suppliers,
  products,
  stock,
  suggestions
}: {
  defaultDate: string;
  suppliers: { id: string; name: string; email: string }[];
  products: ProductPick[];
  stock: StockEntry[];
  suggestions: SupplierOrderSuggestionLine[];
}) {
  const [orderDate, setOrderDate] = useState(defaultDate);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stock) {
      const key = `${s.productId}\0${s.variantSegment}\0${s.sizeLabel}`;
      m.set(key, (m.get(key) ?? 0) + (s.qty ?? 0));
    }
    return m;
  }, [stock]);

  const [lines, setLines] = useState<LineState[]>(() =>
    suggestions.map((s) => ({
      ...s,
      include: s.suggestedQty > 0,
      selectedQty: Math.max(1, s.suggestedQty)
    }))
  );

  const [manualProductId, setManualProductId] = useState("");
  const [manualSegment, setManualSegment] = useState<VariantSegment>("adult");
  const [manualSize, setManualSize] = useState("");
  const [manualQty, setManualQty] = useState(1);

  const manualProduct = manualProductId ? productMap.get(manualProductId) : undefined;
  const manualSizes = useMemo(() => {
    if (!manualProduct) return [];
    const arr = manualSegment === "youth" ? manualProduct.youth.sizes : manualProduct.adult.sizes;
    return [...new Set((arr ?? []).map((s) => String(s).trim()).filter(Boolean))];
  }, [manualProduct, manualSegment]);

  const manualArticleCode = manualProduct
    ? manualSegment === "youth"
      ? manualProduct.youth.modelNumber
      : manualProduct.adult.modelNumber
    : "";

  const includedCount = useMemo(() => lines.filter((l) => l.include && l.selectedQty >= 1).length, [lines]);

  function updateLine(idx: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addManualLine() {
    if (!manualProduct) {
      alert("Kies een product.");
      return;
    }
    const size = manualSize.trim();
    if (!size) {
      alert("Kies een maat.");
      return;
    }
    const qty = Math.max(1, manualQty);
    const currentStock = stockMap.get(`${manualProduct.id}\0${manualSegment}\0${size}`) ?? 0;

    const newLine: LineState = {
      productId: manualProduct.id,
      productName: manualProduct.name,
      articleCode: String(manualArticleCode ?? "").trim(),
      variantSegment: manualSegment,
      sizeLabel: size,
      currentStock,
      thresholdQty: 0,
      targetQty: 0,
      suggestedQty: 1,
      include: true,
      selectedQty: qty
    };

    setLines((prev) => {
      const existingIdx = prev.findIndex(
        (l) => l.productId === newLine.productId && l.variantSegment === newLine.variantSegment && l.sizeLabel === newLine.sizeLabel
      );
      if (existingIdx >= 0) {
        const ex = prev[existingIdx]!;
        const min = Math.max(1, ex.suggestedQty);
        const bumped = Math.max(ex.selectedQty, min, ex.selectedQty + qty);
        return prev.map((l, i) => (i === existingIdx ? { ...l, include: true, selectedQty: bumped } : l));
      }
      return [newLine, ...prev];
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!orderDate.trim()) {
      alert("Datum is verplicht.");
      return;
    }
    if (!supplierId.trim()) {
      alert("Leverancier is verplicht.");
      return;
    }

    const outLines = lines
      .filter((l) => l.include)
      .map((l) => ({
        productId: l.productId,
        variantSegment: l.variantSegment,
        sizeLabel: l.sizeLabel,
        quantity: l.selectedQty
      }))
      .filter((l) => l.quantity >= 1);

    if (outLines.length === 0) {
      alert("Vink minstens één regel aan.");
      return;
    }

    startTransition(() => {
      createSupplierOrderAction({
        orderDate: orderDate.trim(),
        supplierId: supplierId.trim(),
        note: note.trim() || null,
        lines: outLines
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Datum</span>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Leverancier</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          >
            <option value="">— Kies leverancier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Opmerking (optioneel)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          rows={3}
          placeholder="Extra instructies voor de leverancier"
        />
      </label>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Handmatig product toevoegen</h2>
        <p className="mt-1 text-xs text-zinc-500">Voeg extra regels toe naast de automatische aanvulregels.</p>

        <div className="mt-3 grid gap-3 md:grid-cols-12 md:items-end">
          <label className="md:col-span-5">
            <span className="text-xs font-medium text-zinc-600">Product</span>
            <select
              value={manualProductId}
              onChange={(e) => {
                const id = e.target.value;
                setManualProductId(id);
                const p = id ? productMap.get(id) : undefined;
                const defaultSeg: VariantSegment =
                  p && p.youth.sizes.length > 0 && p.adult.sizes.length === 0 ? "youth" : "adult";
                setManualSegment(defaultSeg);
                const sizes = p ? (defaultSeg === "youth" ? p.youth.sizes : p.adult.sizes) : [];
                setManualSize(String(sizes?.[0] ?? ""));
              }}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
            >
              <option value="">— Kies product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-3">
            <span className="text-xs font-medium text-zinc-600">Variant</span>
            <div className="mt-2 inline-flex rounded-full border border-zinc-300 bg-white p-1" role="group" aria-label="Variant">
              <button
                type="button"
                onClick={() => {
                  setManualSegment("youth");
                  const p = manualProductId ? productMap.get(manualProductId) : undefined;
                  const sizes = p ? p.youth.sizes : [];
                  setManualSize(String(sizes?.[0] ?? ""));
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  manualSegment === "youth" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
                disabled={!manualProduct || manualProduct.youth.sizes.length === 0}
              >
                YOUTH
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualSegment("adult");
                  const p = manualProductId ? productMap.get(manualProductId) : undefined;
                  const sizes = p ? p.adult.sizes : [];
                  setManualSize(String(sizes?.[0] ?? ""));
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  manualSegment === "adult" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
                disabled={!manualProduct || manualProduct.adult.sizes.length === 0}
              >
                ADULT
              </button>
            </div>
            {manualArticleCode ? (
              <p className="mt-1 text-xs text-zinc-500">
                Artikelcode: <span className="font-mono text-zinc-800">{manualArticleCode}</span>
              </p>
            ) : null}
          </div>

          <label className="md:col-span-2">
            <span className="text-xs font-medium text-zinc-600">Maat</span>
            <select
              value={manualSize}
              onChange={(e) => setManualSize(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
              disabled={!manualProduct}
            >
              {manualSizes.length === 0 ? <option value="">—</option> : null}
              {manualSizes.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-1">
            <span className="text-xs font-medium text-zinc-600">Aantal</span>
            <select
              value={manualQty}
              onChange={(e) => setManualQty(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
              disabled={!manualProduct}
            >
              {buildQtyOptions(1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-1">
            <button
              type="button"
              onClick={addManualLine}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              disabled={!manualProduct}
            >
              + Toevoegen
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Aanvulregels (op basis van drempelwaarde)</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Je kunt alleen <strong>meer</strong> bestellen dan voorgesteld (dropdown).
              </p>
            </div>
            <div className="text-xs text-zinc-600">
              Geselecteerd: <span className="font-semibold text-zinc-900">{includedCount}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[58rem] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                <th className="px-6 py-3">Bestellen</th>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Artikelcode</th>
                <th className="px-6 py-3">Variant</th>
                <th className="px-6 py-3">Maat</th>
                <th className="px-6 py-3 text-right">Voorraad</th>
                <th className="px-6 py-3 text-right">Drempel</th>
                <th className="px-6 py-3 text-right">Standaard</th>
                <th className="px-6 py-3 text-right">Voorstel</th>
                <th className="px-6 py-3">Aantal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {lines.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-sm text-zinc-600" colSpan={10}>
                    Geen regels gevonden die onder de drempelwaarde zitten.
                  </td>
                </tr>
              ) : (
                lines.map((l, idx) => {
                  const min = Math.max(1, l.suggestedQty);
                  const opts = buildQtyOptions(min);
                  return (
                    <tr key={`${l.productId}-${l.variantSegment}-${l.sizeLabel}`}>
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={l.include}
                          onChange={(e) => updateLine(idx, { include: e.target.checked })}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-6 py-3">{l.productName}</td>
                      <td className="px-6 py-3 font-mono text-zinc-800">{l.articleCode || "—"}</td>
                      <td className="px-6 py-3 text-zinc-700">{l.variantSegment === "youth" ? "YOUTH" : "ADULT"}</td>
                      <td className="px-6 py-3 font-mono text-zinc-800">{l.sizeLabel}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{l.currentStock}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{l.thresholdQty}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{l.targetQty}</td>
                      <td className="px-6 py-3 text-right tabular-nums font-semibold">{l.suggestedQty}</td>
                      <td className="px-6 py-3">
                        <select
                          value={l.selectedQty}
                          onChange={(e) => updateLine(idx, { selectedQty: Number(e.target.value) || min })}
                          className="w-28 rounded-md border border-zinc-300 px-2 py-2 text-sm"
                          disabled={!l.include}
                        >
                          {opts.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Bezig…" : "BESTELLEN"}
        </button>
        <Link href="/dashboard/stock" className="text-sm text-zinc-600 hover:text-zinc-900">
          Annuleren
        </Link>
      </div>
    </form>
  );
}

