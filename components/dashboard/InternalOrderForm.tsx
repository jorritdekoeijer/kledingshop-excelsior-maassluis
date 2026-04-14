"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createInternalOrderAction } from "@/app/dashboard/stock/interne-bestelling/actions";
import { normalizeVariantBlock } from "@/lib/shop/product-json";

type VariantSegment = "youth" | "adult";

type ProductRow = {
  id: string;
  name: string;
  variant_youth: unknown;
  variant_adult: unknown;
  stock_batches?: {
    quantity_remaining: number | null;
    variant_segment: string | null;
    size_label: string | null;
    unit_purchase_excl_cents: number | null;
    unit_printing_excl_cents?: number | null;
    received_at: string | null;
    created_at: string | null;
  }[];
};

type CostGroup = { id: string; name: string };

type LineState = {
  key: string;
  productId: string;
  segment: VariantSegment;
  sizeLabel: string;
  quantity: number;
};

function emptyLine(): LineState {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    productId: "",
    segment: "adult",
    sizeLabel: "",
    quantity: 1
  };
}

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

function defaultSegmentForProduct(p: ProductRow | undefined): VariantSegment {
  if (!p) return "adult";
  const y = normalizeVariantBlock(p.variant_youth).sizes.length;
  const a = normalizeVariantBlock(p.variant_adult).sizes.length;
  if (y > 0 && a === 0) return "youth";
  if (a > 0 && y === 0) return "adult";
  return "adult";
}

function segmentSizes(p: ProductRow, seg: VariantSegment): string[] {
  const v = seg === "youth" ? normalizeVariantBlock(p.variant_youth) : normalizeVariantBlock(p.variant_adult);
  return [...new Set((v.sizes ?? []).map((s) => String(s).trim()).filter(Boolean))];
}

function segmentModel(p: ProductRow, seg: VariantSegment): string {
  const v = seg === "youth" ? normalizeVariantBlock(p.variant_youth) : normalizeVariantBlock(p.variant_adult);
  return String(v.model_number ?? "").trim();
}

export function InternalOrderForm({
  products,
  costGroups
}: {
  products: ProductRow[];
  costGroups: CostGroup[];
}) {
  const [orderDate, setOrderDate] = useState("");
  const [costGroupId, setCostGroupId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineState[]>(() => [emptyLine()]);
  const [pending, startTransition] = useTransition();

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  type BatchSnap = {
    productId: string;
    variant: VariantSegment;
    size: string;
    qty: number;
    unit: number | null;
    unitPrinting: number | null;
    receivedAt: string;
    createdAt: string;
  };

  const batchIndex = useMemo(() => {
    const m = new Map<string, BatchSnap[]>();
    for (const p of products) {
      const bs = p.stock_batches ?? [];
      for (const b of bs) {
        const qty = b.quantity_remaining ?? 0;
        if (qty <= 0) continue;
        const variant = String(b.variant_segment ?? "").trim();
        const size = String(b.size_label ?? "").trim();
        if (variant !== "youth" && variant !== "adult") continue;
        if (!size) continue;
        const key = `${p.id}\0${variant}\0${size}`;
        const arr = m.get(key) ?? [];
        arr.push({
          productId: p.id,
          variant: variant as VariantSegment,
          size,
          qty,
          unit:
            typeof b.unit_purchase_excl_cents === "number" && Number.isFinite(b.unit_purchase_excl_cents)
              ? b.unit_purchase_excl_cents
              : null,
          unitPrinting:
            typeof b.unit_printing_excl_cents === "number" && Number.isFinite(b.unit_printing_excl_cents)
              ? b.unit_printing_excl_cents
              : null,
          receivedAt: String(b.received_at ?? ""),
          createdAt: String(b.created_at ?? "")
        });
        m.set(key, arr);
      }
    }
    for (const [k, arr] of m) {
      arr.sort((a, b) => {
        if (a.receivedAt < b.receivedAt) return -1;
        if (a.receivedAt > b.receivedAt) return 1;
        if (a.createdAt < b.createdAt) return -1;
        if (a.createdAt > b.createdAt) return 1;
        return 0;
      });
      m.set(k, arr);
    }
    return m;
  }, [products]);

  const totalExclEstimate = useMemo(() => {
    const remainingByBatch = new Map<BatchSnap, number>();
    for (const arr of batchIndex.values()) {
      for (const b of arr) remainingByBatch.set(b, b.qty);
    }
    let total = 0;
    for (const l of lines) {
      if (!l.productId || !l.sizeLabel.trim()) continue;
      let need = Math.max(0, l.quantity);
      const key = `${l.productId}\0${l.segment}\0${l.sizeLabel.trim()}`;
      const arr = batchIndex.get(key) ?? [];
      for (const b of arr) {
        if (need <= 0) break;
        const have = remainingByBatch.get(b) ?? 0;
        if (have <= 0) continue;
        const take = Math.min(need, have);
        remainingByBatch.set(b, have - take);
        if (b.unit != null) {
          const print = b.unitPrinting != null ? b.unitPrinting : 0;
          total += take * (b.unit + print);
        }
        need -= take;
      }
    }
    return total;
  }, [lines, batchIndex]);

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onProductChange(key: string, productId: string) {
    const p = productId ? productMap.get(productId) : undefined;
    const seg = defaultSegmentForProduct(p);
    const sizes = p ? segmentSizes(p, seg) : [];
    updateLine(key, {
      productId,
      segment: seg,
      sizeLabel: sizes[0] ?? ""
    });
  }

  function onSegmentChange(key: string, productId: string, seg: VariantSegment) {
    const p = productId ? productMap.get(productId) : undefined;
    if (!p) return;
    const sizes = segmentSizes(p, seg);
    updateLine(key, {
      segment: seg,
      sizeLabel: sizes[0] ?? ""
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const outLines: {
      productId: string;
      variantSegment: VariantSegment;
      quantity: number;
      sizeLabel: string;
    }[] = [];

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

    if (!orderDate.trim()) {
      alert("Datum is verplicht.");
      return;
    }
    if (!costGroupId.trim()) {
      alert("Kostengroep is verplicht.");
      return;
    }
    if (note.trim().length < 3) {
      alert("Omschrijving is verplicht.");
      return;
    }
    if (outLines.length === 0) {
      alert("Voeg minstens één regel met product toe.");
      return;
    }

    startTransition(() => {
      createInternalOrderAction({
        orderDate: orderDate.trim(),
        costGroupId: costGroupId.trim(),
        note: note.trim(),
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
          <span className="text-sm font-medium text-zinc-700">Kostengroep</span>
          <select
            value={costGroupId}
            onChange={(e) => setCostGroupId(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          >
            <option value="">— Kies kostengroep —</option>
            {costGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Omschrijving (verplicht)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          rows={3}
          placeholder="Bijv. Aanvullen kousen 1e elftal"
          required
        />
      </label>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Regels</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Kies product, jeugd/volwassen en maat. Het totaal wordt berekend op basis van de inkoopprijs uit de voorraadleveringen (FIFO).
        </p>

        <div className="mt-4 space-y-4">
          {lines.map((line) => {
            const p = line.productId ? productMap.get(line.productId) : undefined;
            const sizes = p ? segmentSizes(p, line.segment) : [];
            const showToggle = Boolean(p && segmentSizes(p, "youth").length > 0 && segmentSizes(p, "adult").length > 0);
            const model = p ? segmentModel(p, line.segment) : "";
            const lineTotal = (() => {
              if (!line.productId || !line.sizeLabel.trim()) return null;
              let need = Math.max(0, line.quantity);
              const key = `${line.productId}\0${line.segment}\0${line.sizeLabel.trim()}`;
              const arr = batchIndex.get(key) ?? [];
              let t = 0;
              for (const b of arr) {
                if (need <= 0) break;
                const take = Math.min(need, b.qty);
                if (b.unit != null) t += take * b.unit;
                need -= take;
              }
              return t;
            })();

            return (
              <div
                key={line.key}
                className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 md:grid-cols-12 md:items-end"
              >
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

                <label className="md:col-span-4">
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
                  <span className="text-xs font-medium text-zinc-600">Jeugd / Volwassenen</span>
                  {!line.productId ? (
                    <p className="mt-2 text-xs text-zinc-400">Kies eerst een product</p>
                  ) : showToggle ? (
                    <div
                      className="mt-2 inline-flex rounded-full border border-zinc-300 bg-white p-1"
                      role="group"
                      aria-label="Jeugd of volwassenen"
                    >
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
                      {line.segment === "youth" ? "Jeugd (YOUTH)" : "Volwassenen (ADULT)"}
                    </p>
                  )}
                  {model ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Model: <span className="font-mono text-zinc-800">{model}</span>
                    </p>
                  ) : null}
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

                <div className="md:col-span-2">
                  <span className="text-xs font-medium text-zinc-600">Inkoop (FIFO)</span>
                  <p className="mt-2 text-xs text-zinc-600">Automatisch uit voorraadleveringen.</p>
                </div>

                <div className="flex items-end justify-between gap-4 md:col-span-12">
                  <div className="text-xs text-zinc-600">
                    Regel totaal:{" "}
                    <span className="font-semibold text-zinc-900">{lineTotal != null ? eur(lineTotal) : "—"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== line.key))}
                    disabled={lines.length <= 1}
                    className="text-sm text-red-700 hover:underline disabled:opacity-40"
                  >
                    Regel verwijderen
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="mt-4 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          + Regel toevoegen
        </button>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-zinc-900">Totaal inkoop excl. btw</div>
          <div className="text-lg font-bold tabular-nums text-zinc-900">{eur(totalExclEstimate)}</div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Indicatie op basis van huidige FIFO-voorraad. Definitief totaal wordt bij opslaan vastgelegd.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Bezig…" : "Interne bestelling opslaan"}
        </button>
        <Link href="/dashboard/stock" className="text-sm text-zinc-600 hover:text-zinc-900">
          Annuleren
        </Link>
      </div>
    </form>
  );
}

