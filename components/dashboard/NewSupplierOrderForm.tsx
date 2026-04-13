"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createSupplierOrderAction } from "@/app/dashboard/stock/leveranciersbestelling/nieuw/actions";

type VariantSegment = "youth" | "adult";

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

function eur(cents: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

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
  suggestions
}: {
  defaultDate: string;
  suppliers: { id: string; name: string; email: string }[];
  suggestions: SupplierOrderSuggestionLine[];
}) {
  const [orderDate, setOrderDate] = useState(defaultDate);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const [lines, setLines] = useState<LineState[]>(() =>
    suggestions.map((s) => ({
      ...s,
      include: s.suggestedQty > 0,
      selectedQty: Math.max(1, s.suggestedQty)
    }))
  );

  const includedCount = useMemo(() => lines.filter((l) => l.include && l.selectedQty >= 1).length, [lines]);

  function updateLine(idx: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
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

