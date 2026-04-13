"use client";

import { useMemo, useState, useTransition } from "react";

type VariantSegment = "youth" | "adult";

export type ExistingRule = {
  variant_segment: VariantSegment;
  size_label: string;
  is_active: boolean;
  threshold_qty: number;
  target_qty: number;
};

type VariantBlockLite = { sizes: string[]; model_number: string };

export function ProductReorderRulesEditor({
  productId,
  youth,
  adult,
  existing,
  action
}: {
  productId: string;
  youth: VariantBlockLite;
  adult: VariantBlockLite;
  existing: ExistingRule[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  const allRows = useMemo(() => {
    const key = (seg: VariantSegment, size: string) => `${seg}\0${size}`;
    const map = new Map<string, ExistingRule>();
    for (const r of existing) {
      map.set(key(r.variant_segment, r.size_label), r);
    }

    const build = (seg: VariantSegment, sizes: string[]) =>
      [...new Set(sizes.map((s) => String(s).trim()).filter(Boolean))].map((size) => {
        const ex = map.get(key(seg, size));
        return {
          variantSegment: seg,
          sizeLabel: size,
          isActive: ex?.is_active ?? false,
          thresholdQty: ex?.threshold_qty ?? 0,
          targetQty: ex?.target_qty ?? 0
        };
      });

    return [...build("youth", youth.sizes ?? []), ...build("adult", adult.sizes ?? [])];
  }, [existing, youth.sizes, adult.sizes]);

  const [rows, setRows] = useState(() => allRows);

  // Als sizes wijzigen (model edit), keep best effort sync.
  const rowsJson = useMemo(() => JSON.stringify(rows), [rows]);

  function update(idx: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("rulesJson", rowsJson);
    startTransition(() => {
      action(fd);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="productId" value={productId} readOnly />
      <input type="hidden" name="rulesJson" value={rowsJson} readOnly />

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <th className="px-4 py-3">Actief</th>
              <th className="px-4 py-3">Variant</th>
              <th className="px-4 py-3">Maat</th>
              <th className="px-4 py-3">Drempelwaarde</th>
              <th className="px-4 py-3">Standaard voorraad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.map((r, idx) => (
              <tr key={`${r.variantSegment}-${r.sizeLabel}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={(e) => update(idx, { isActive: e.target.checked })}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-4 py-3 text-zinc-700">{r.variantSegment === "youth" ? "YOUTH" : "ADULT"}</td>
                <td className="px-4 py-3 font-mono text-zinc-800">{r.sizeLabel}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    value={r.thresholdQty}
                    onChange={(e) => update(idx, { thresholdQty: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    value={r.targetQty}
                    onChange={(e) => update(idx, { targetQty: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Als voorraad ≤ drempelwaarde, wordt in <strong>Nieuwe leveranciersbestelling</strong> een suggestie gemaakt om tot de
          standaard voorraad aan te vullen.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}

