"use client";

import { useMemo, useState } from "react";

export type StockRow = {
  name: string;
  variantLabel: string;
  sizeLabel: string;
  qty: number;
  /** Artikelcode/modelnummer behorend bij de variant (youth/adult). */
  articleCode: string;
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export function StockRowsTable({ rows }: { rows: StockRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const nq = normalize(q);
    if (!nq) return rows;
    return rows.filter((r) => {
      const name = normalize(r.name);
      const code = normalize(r.articleCode ?? "");
      return name.includes(nq) || code.includes(nq);
    });
  }, [rows, q]);

  return (
    <div>
      <div className="border-b border-zinc-200 px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Voorraad per variant en maat</h2>
            <p className="mt-1 text-xs text-zinc-500">Zoek op productnaam of artikelcode (modelnummer).</p>
          </div>
          <label className="w-full sm:max-w-xs">
            <span className="sr-only">Zoeken</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Zoek op naam of artikelcode…"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3">Artikelcode</th>
              <th className="px-6 py-3">Variant</th>
              <th className="px-6 py-3">Maat</th>
              <th className="px-6 py-3 text-right">Stuks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filtered.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-sm text-zinc-600" colSpan={5}>
                  Geen resultaten voor “{q}”.
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={`${row.name}-${row.articleCode}-${row.variantLabel}-${row.sizeLabel}-${i}`}>
                  <td className="px-6 py-3">{row.name}</td>
                  <td className="px-6 py-3 font-mono text-zinc-800">{row.articleCode || "—"}</td>
                  <td className="px-6 py-3 text-zinc-700">{row.variantLabel}</td>
                  <td className="px-6 py-3 font-mono text-zinc-800">{row.sizeLabel}</td>
                  <td className="px-6 py-3 text-right tabular-nums text-zinc-900">{row.qty}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

