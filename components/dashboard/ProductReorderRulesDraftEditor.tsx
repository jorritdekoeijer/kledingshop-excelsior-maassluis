"use client";

import { useEffect, useMemo, useState } from "react";
import { ADULT_SIZE_OPTIONS, SHOES_SIZE_OPTIONS, SOCKS_SIZE_OPTIONS, YOUTH_SIZE_OPTIONS } from "@/lib/products/variant-constants";

type VariantSegment = "youth" | "adult" | "socks" | "shoes";

type Row = {
  variantSegment: VariantSegment;
  sizeLabel: string;
  isActive: boolean;
  thresholdQty: number;
  targetQty: number;
};

function uniqNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((s) => String(s).trim()).filter(Boolean))];
}

export function ProductReorderRulesDraftEditor({
  garmentType,
  name = "reorderRulesJson"
}: {
  garmentType: "clothing" | "socks" | "shoes";
  /** Naam van hidden input dat bij submit meegaat. */
  name?: string;
}) {
  const templateRows = useMemo((): Row[] => {
    const build = (seg: VariantSegment, sizes: string[]) =>
      uniqNonEmpty(sizes).map((size) => ({
        variantSegment: seg,
        sizeLabel: size,
        isActive: false,
        thresholdQty: 0,
        targetQty: 0
      }));

    if (garmentType === "socks") return build("socks", [...SOCKS_SIZE_OPTIONS]);
    if (garmentType === "shoes") return build("shoes", [...SHOES_SIZE_OPTIONS]);
    return [...build("youth", [...YOUTH_SIZE_OPTIONS]), ...build("adult", [...ADULT_SIZE_OPTIONS])];
  }, [garmentType]);

  const [rows, setRows] = useState<Row[]>(() => templateRows);

  // Als garment type wisselt: reset naar de nieuwe template.
  useEffect(() => {
    setRows(templateRows);
  }, [templateRows]);

  const rowsJson = useMemo(() => JSON.stringify(rows), [rows]);

  function update(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={rowsJson} readOnly />

      <h2 className="text-lg font-semibold">Voorraad instellingen per maat</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Zet maten <strong>actief</strong> en vul een drempelwaarde en standaard voorraad in. Na opslaan worden deze regels direct
        aangemaakt voor dit product.
      </p>

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
                <td className="px-4 py-3 text-zinc-700">
                  {r.variantSegment === "youth"
                    ? "YOUTH"
                    : r.variantSegment === "adult"
                      ? "ADULT"
                      : r.variantSegment === "socks"
                        ? "SOCKS"
                        : "SHOES"}
                </td>
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
    </div>
  );
}

