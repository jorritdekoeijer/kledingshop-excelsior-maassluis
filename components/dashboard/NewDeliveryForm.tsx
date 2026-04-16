"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createStockDeliveryAction } from "@/app/dashboard/stock/levering/nieuw/actions";
import { inclCentsFromExcl21, parseDutchEuroToCents } from "@/lib/money/nl-euro";
import type { ProductPickOption, VariantSegment } from "@/lib/stock/product-pick-types";

export type { ProductPickOption, VariantSegment };

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

type LineState = {
  key: string;
  productId: string;
  segment: VariantSegment;
  quantity: number;
  sizeLabel: string;
  unitExclEuro: string;
};

function emptyLine(): LineState {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
    productId: "",
    segment: "adult",
    quantity: 1,
    sizeLabel: "",
    unitExclEuro: ""
  };
}

function defaultSegmentForProduct(p: ProductPickOption | undefined): VariantSegment {
  if (!p) return "adult";
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
  return p.shoes?.sizes ?? [];
}

function modelForSegment(p: ProductPickOption, seg: VariantSegment): string {
  if (seg === "youth") return p.youth.modelNumber;
  if (seg === "adult") return p.adult.modelNumber;
  if (seg === "socks") return p.socks?.modelNumber ?? "";
  return p.shoes?.modelNumber ?? "";
}

export function NewDeliveryForm({ products }: { products: ProductPickOption[] }) {
  const [invoiceDate, setInvoiceDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceTotalInclEuro, setInvoiceTotalInclEuro] = useState("");
  const [lines, setLines] = useState<LineState[]>(() => [emptyLine()]);
  const [pending, startTransition] = useTransition();

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const totals = useMemo(() => {
    let excl = 0;
    let printingExcl = 0;
    for (const line of lines) {
      if (!line.productId) continue;
      const unit = parseDutchEuroToCents(line.unitExclEuro);
      if (!Number.isFinite(unit)) continue;
      excl += unit * Math.max(0, line.quantity);
      const p = productMap.get(line.productId);
      const pr = p ? Math.max(0, Number(p.printingExclCents ?? 0) || 0) : 0;
      printingExcl += pr * Math.max(0, line.quantity);
    }
    const incl = inclCentsFromExcl21(excl);
    const vat = incl - excl;
    return { excl, vat, incl, printingExcl, totalExclInclPrinting: excl + printingExcl };
  }, [lines, productMap]);

  const invoiceInclParsed = useMemo(() => {
    const v = parseDutchEuroToCents(invoiceTotalInclEuro);
    if (!Number.isFinite(v) || !invoiceTotalInclEuro.trim()) return null;
    return v;
  }, [invoiceTotalInclEuro]);

  const controlDiff =
    invoiceInclParsed != null ? totals.incl - invoiceInclParsed : null;

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onProductChange(key: string, productId: string) {
    const p = productMap.get(productId);
    const seg = defaultSegmentForProduct(p);
    const sizes = p ? sizesForSegment(p, seg) : [];
    updateLine(key, {
      productId,
      segment: seg,
      sizeLabel: sizes[0] ?? ""
    });
  }

  function onSegmentChange(key: string, productId: string, segment: VariantSegment) {
    const p = productMap.get(productId);
    if (!p) return;
    const sizes = sizesForSegment(p, segment);
    updateLine(key, {
      segment,
      sizeLabel: sizes[0] ?? ""
    });
  }

  function segmentButtons(key: string, productId: string, current: VariantSegment) {
    const p = productMap.get(productId);
    if (!p) return null;
    const hasShoes = (p.shoes?.sizes.length ?? 0) > 0;
    const hasSocks = (p.socks?.sizes.length ?? 0) > 0;
    if (hasShoes) {
      return (
        <div className="mt-2 inline-flex rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
          SHOES
        </div>
      );
    }
    if (hasSocks) {
      return (
        <div className="mt-2 inline-flex rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
          SOCKS
        </div>
      );
    }
    return (
      <div
        className="mt-2 inline-flex rounded-full border border-zinc-300 bg-white p-1"
        role="group"
        aria-label="Jeugd of volwassenen"
      >
        <button
          type="button"
          onClick={() => onSegmentChange(key, productId, "youth")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            current === "youth" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          YOUTH
        </button>
        <button
          type="button"
          onClick={() => onSegmentChange(key, productId, "adult")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            current === "adult" ? "bg-brand-blue text-white" : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          ADULT
        </button>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const outLines: {
      productId: string;
      variantSegment: VariantSegment;
      quantity: number;
      sizeLabel: string;
      unitPurchaseExclCents: number;
      unitPrintingExclCents: number;
    }[] = [];

    for (const line of lines) {
      if (!line.productId) continue;
      const unit = parseDutchEuroToCents(line.unitExclEuro);
      if (!Number.isFinite(unit) || unit < 0) {
        alert("Vul per regel een geldige inkoopprijs excl. btw in (bijv. 12,50).");
        return;
      }
      if (!line.sizeLabel.trim()) {
        alert("Kies per regel een maat (of vul deze in bij producten zonder vaste matenlijst).");
        return;
      }
      if (line.quantity < 1) {
        alert("Aantal moet minstens 1 zijn.");
        return;
      }
      const p = productMap.get(line.productId);
      if (!p) continue;
      const allowed = sizesForSegment(p, line.segment);
      if (allowed.length > 0 && !allowed.includes(line.sizeLabel.trim())) {
        alert(
          `Maat "${line.sizeLabel}" hoort niet bij ${
            line.segment === "youth" ? "Jeugd" : line.segment === "adult" ? "Volwassenen" : line.segment.toUpperCase()
          } voor dit product.`
        );
        return;
      }
      outLines.push({
        productId: line.productId,
        variantSegment: line.segment,
        quantity: line.quantity,
        sizeLabel: line.sizeLabel.trim(),
        unitPurchaseExclCents: unit,
        unitPrintingExclCents: Math.max(0, Number(p.printingExclCents ?? 0) || 0)
      });
    }

    if (outLines.length === 0) {
      alert("Voeg minstens één regel met product toe.");
      return;
    }

    const payload = {
      invoiceDate: invoiceDate.trim() || null,
      supplier: supplier.trim() || null,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceTotalInclCents: invoiceInclParsed,
      lines: outLines
    };

    startTransition(() => {
      createStockDeliveryAction(payload);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Factuurdatum</span>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Leverancier</span>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Naam leverancier"
          />
        </label>
        <label className="block sm:col-span-3">
          <span className="text-sm font-medium text-zinc-700">Factuurnummer</span>
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="mt-1 w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Factuurnummer"
          />
        </label>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Regels</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Kies eerst <strong>Jeugd</strong> of <strong>Volwassenen</strong> — elk heeft een eigen modelnummer en maten. Inkoop is{" "}
          <strong>excl. btw</strong> per stuk (factuur). Bedrukking wordt automatisch toegevoegd aan kostprijs.
        </p>

        <div className="mt-4 space-y-4">
          {lines.map((line) => {
            const p = line.productId ? productMap.get(line.productId) : undefined;
            const sizeOptions = p ? sizesForSegment(p, line.segment) : [];
            const model = p ? modelForSegment(p, line.segment) : "";
            const showToggle = p && p.youth.sizes.length > 0 && p.adult.sizes.length > 0;
            const printing = p ? Math.max(0, Number(p.printingExclCents ?? 0) || 0) : 0;
            const baseUnit = parseDutchEuroToCents(line.unitExclEuro);
            const totalUnit = Number.isFinite(baseUnit) ? baseUnit + printing : null;

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
                    segmentButtons(line.key, line.productId, line.segment)
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
                  ) : sizeOptions.length > 0 ? (
                    <select
                      value={line.sizeLabel}
                      onChange={(e) => updateLine(line.key, { sizeLabel: e.target.value })}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                    >
                      {sizeOptions.map((sz) => (
                        <option key={sz} value={sz}>
                          {sz}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={line.sizeLabel}
                      onChange={(e) => updateLine(line.key, { sizeLabel: e.target.value })}
                      placeholder="Bv. onesize"
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                    />
                  )}
                </label>
                <label className="md:col-span-2">
                  <span className="text-xs font-medium text-zinc-600">Inkoop / stuk excl. btw (€)</span>
                  <input
                    value={line.unitExclEuro}
                    onChange={(e) => updateLine(line.key, { unitExclEuro: e.target.value })}
                    placeholder="12,50"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                  />
                  {line.productId ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Bedrukking: <span className="font-medium text-zinc-800">{eur(printing)}</span>
                      {totalUnit != null ? (
                        <>
                          {" "}
                          · Totaal inkoop: <span className="font-semibold text-zinc-900">{eur(totalUnit)}</span>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </label>
                <div className="flex md:col-span-12 md:justify-end">
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

      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
        <h2 className="text-sm font-semibold text-amber-950">Controle factuur (btw 21%)</h2>
        <p className="mt-1 text-xs text-amber-900/90">
          Deze controle is alleen voor de factuur (basis-inkoop). Bedrukkingskosten tellen hier niet mee.
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-zinc-600">Totaal excl. btw (som regels)</dt>
            <dd className="font-medium tabular-nums text-zinc-900">{eur(totals.excl)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-zinc-600">Bedrukking excl. btw (extern)</dt>
            <dd className="font-medium tabular-nums text-zinc-900">{eur(totals.printingExcl)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-zinc-600">Btw 21%</dt>
            <dd className="font-medium tabular-nums text-zinc-900">{eur(totals.vat)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-zinc-600">Totaal inkoop excl. (incl. bedrukking)</dt>
            <dd className="font-semibold tabular-nums text-zinc-900">{eur(totals.totalExclInclPrinting)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-amber-200 pt-2 sm:col-span-2 sm:flex sm:justify-between">
            <dt className="font-semibold text-amber-950">Totaal incl. btw (berekend)</dt>
            <dd className="text-lg font-bold tabular-nums text-amber-950">{eur(totals.incl)}</dd>
          </div>
        </dl>

        <label className="mt-4 block max-w-xs">
          <span className="text-xs font-medium text-zinc-700">Factuurbedrag incl. btw (ter controle, optioneel)</span>
          <input
            value={invoiceTotalInclEuro}
            onChange={(e) => setInvoiceTotalInclEuro(e.target.value)}
            placeholder="Vul in zoals op factuur"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        {controlDiff != null && invoiceInclParsed != null ? (
          <p className={`mt-2 text-sm ${controlDiff === 0 ? "text-green-800" : "text-red-800"}`}>
            {controlDiff === 0
              ? "Komt overeen met de factuur."
              : `Verschil met ingevoerde factuur: ${controlDiff > 0 ? "+" : ""}${eur(controlDiff)}`}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Bezig…" : "Levering opslaan"}
        </button>
        <Link href="/dashboard/stock" className="text-sm text-zinc-600 hover:text-zinc-900">
          Annuleren
        </Link>
      </div>
    </form>
  );
}
