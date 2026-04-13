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
};

type CostGroup = { id: string; name: string };

type LineState = {
  key: string;
  productId: string;
  segment: VariantSegment;
  sizeLabel: string;
  quantity: number;
  unitPurchaseExclCents: number | null;
};

function emptyLine(): LineState {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    productId: "",
    segment: "adult",
    sizeLabel: "",
    quantity: 1,
    unitPurchaseExclCents: null
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

function segmentPurchaseCents(p: ProductRow, seg: VariantSegment): number | null {
  const v = seg === "youth" ? normalizeVariantBlock(p.variant_youth) : normalizeVariantBlock(p.variant_adult);
  const pc = v.purchase_cents;
  return typeof pc === "number" && Number.isFinite(pc) && pc >= 0 ? pc : null;
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

  const totalExcl = useMemo(() => {
    let sum = 0;
    for (const l of lines) {
      if (!l.productId) continue;
      const unit = l.unitPurchaseExclCents;
      if (unit == null || !Number.isFinite(unit)) continue;
      sum += Math.max(0, l.quantity) * Math.max(0, unit);
    }
    return sum;
  }, [lines]);

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onProductChange(key: string, productId: string) {
    const p = productId ? productMap.get(productId) : undefined;
    const seg = defaultSegmentForProduct(p);
    const sizes = p ? segmentSizes(p, seg) : [];
    const unit = p ? segmentPurchaseCents(p, seg) : null;
    updateLine(key, {
      productId,
      segment: seg,
      sizeLabel: sizes[0] ?? "",
      unitPurchaseExclCents: unit
    });
  }

  function onSegmentChange(key: string, productId: string, seg: VariantSegment) {
    const p = productId ? productMap.get(productId) : undefined;
    if (!p) return;
    const sizes = segmentSizes(p, seg);
    const unit = segmentPurchaseCents(p, seg);
    updateLine(key, {
      segment: seg,
      sizeLabel: sizes[0] ?? "",
      unitPurchaseExclCents: unit
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const outLines: {
      productId: string;
      variantSegment: VariantSegment;
      quantity: number;
      sizeLabel: string;
      unitPurchaseExclCents: number;
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
      if (l.unitPurchaseExclCents == null || !Number.isFinite(l.unitPurchaseExclCents) || l.unitPurchaseExclCents < 0) {
        alert("Inkoopprijs ontbreekt. Zet in Producten → bewerk het product de inkoopprijs per variant, of vul per regel handmatig in.");
        return;
      }
      outLines.push({
        productId: l.productId,
        variantSegment: l.segment,
        quantity: l.quantity,
        sizeLabel: l.sizeLabel.trim(),
        unitPurchaseExclCents: l.unitPurchaseExclCents
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
          Kies product, jeugd/volwassen en maat. Het totaal wordt berekend op basis van de inkoopprijs excl. btw per variant.
        </p>

        <div className="mt-4 space-y-4">
          {lines.map((line) => {
            const p = line.productId ? productMap.get(line.productId) : undefined;
            const sizes = p ? segmentSizes(p, line.segment) : [];
            const showToggle = Boolean(p && segmentSizes(p, "youth").length > 0 && segmentSizes(p, "adult").length > 0);
            const model = p ? segmentModel(p, line.segment) : "";
            const unit = line.unitPurchaseExclCents;
            const lineTotal = unit != null && Number.isFinite(unit) ? unit * Math.max(0, line.quantity) : null;

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

                <label className="md:col-span-2">
                  <span className="text-xs font-medium text-zinc-600">Inkoop / stuk (excl. btw)</span>
                  <input
                    type="number"
                    min={0}
                    value={unit ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      updateLine(line.key, { unitPurchaseExclCents: v != null && Number.isFinite(v) ? Math.max(0, Math.round(v)) : null });
                    }}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                    placeholder="centen"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">In centen (bijv. 1250 voor €12,50)</p>
                </label>

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
          <div className="text-lg font-bold tabular-nums text-zinc-900">{eur(totalExcl)}</div>
        </div>
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

