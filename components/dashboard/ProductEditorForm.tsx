"use client";

import { useMemo, useState } from "react";
import { ADULT_SIZE_OPTIONS, YOUTH_SIZE_OPTIONS } from "@/lib/products/variant-constants";
import { exclCentsFromIncl21, inclCentsFromExcl21, parseDutchEuroToCents } from "@/lib/money/nl-euro";
import type { ProductDetailRow, ProductVariantBlock } from "@/lib/validation/products";

function centsToNlInput(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) return "0,00";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function centsToOptionalNl(c: number | null | undefined): string {
  if (c === null || c === undefined) return "";
  return centsToNlInput(c);
}

function nlInputToCents(s: string): number {
  const n = parseDutchEuroToCents(s);
  return Number.isNaN(n) ? 0 : n;
}

type Defaults = {
  name: string;
  slug: string;
  description: string | null;
  temporaryDiscountPercent: number;
  active: boolean;
  categoryId: string | null;
  productDetails: ProductDetailRow[];
  variantYouth: ProductVariantBlock;
  variantAdult: ProductVariantBlock;
};

const emptyVariant = (): ProductVariantBlock => ({
  purchase_cents: null,
  sale_cents: null,
  model_number: "",
  sizes: []
});

type Cat = { id: string; name: string };

function saleExclFromInclCents(cents: number | null | undefined): string {
  if (cents == null || cents < 0) return "";
  return centsToNlInput(exclCentsFromIncl21(cents));
}

export function ProductEditorForm({
  action,
  categories,
  defaults,
  showImageUpload = false
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: Cat[];
  defaults?: Partial<Defaults>;
  showImageUpload?: boolean;
}) {
  const d: Defaults = {
    name: defaults?.name ?? "",
    slug: defaults?.slug ?? "",
    description: defaults?.description ?? "",
    temporaryDiscountPercent: defaults?.temporaryDiscountPercent ?? 0,
    active: defaults?.active ?? true,
    categoryId: defaults?.categoryId ?? null,
    productDetails: defaults?.productDetails ?? [],
    variantYouth: defaults?.variantYouth ?? emptyVariant(),
    variantAdult: defaults?.variantAdult ?? emptyVariant()
  };

  const [details, setDetails] = useState<ProductDetailRow[]>(d.productDetails);
  const [youth, setYouth] = useState<ProductVariantBlock>(d.variantYouth);
  const [adult, setAdult] = useState<ProductVariantBlock>(d.variantAdult);

  const [youthPurchase, setYouthPurchase] = useState(() => centsToOptionalNl(d.variantYouth.purchase_cents));
  const [adultPurchase, setAdultPurchase] = useState(() => centsToOptionalNl(d.variantAdult.purchase_cents));

  const [youthSaleIncl, setYouthSaleIncl] = useState(() => centsToOptionalNl(d.variantYouth.sale_cents));
  const [youthSaleExcl, setYouthSaleExcl] = useState(() => saleExclFromInclCents(d.variantYouth.sale_cents ?? null));

  const [adultSaleIncl, setAdultSaleIncl] = useState(() => centsToOptionalNl(d.variantAdult.sale_cents));
  const [adultSaleExcl, setAdultSaleExcl] = useState(() => saleExclFromInclCents(d.variantAdult.sale_cents ?? null));

  const productDetailsJson = useMemo(
    () =>
      JSON.stringify(
        details
          .filter((r) => r.label.trim().length > 0)
          .map((r) => ({ label: r.label.trim(), value: r.value.trim() }))
      ),
    [details]
  );

  const variantYouthJson = useMemo(() => {
    const purchase_cents = nlInputToCents(youthPurchase) || null;
    const sale_cents =
      youthSaleIncl.trim().length > 0
        ? (() => {
            const c = nlInputToCents(youthSaleIncl);
            return Number.isFinite(c) && c >= 0 ? c : null;
          })()
        : null;
    return JSON.stringify({
      ...youth,
      purchase_cents: youthPurchase.trim() ? purchase_cents : null,
      sale_cents
    });
  }, [youth, youthPurchase, youthSaleIncl]);

  const variantAdultJson = useMemo(() => {
    const purchase_cents = nlInputToCents(adultPurchase) || null;
    const sale_cents =
      adultSaleIncl.trim().length > 0
        ? (() => {
            const c = nlInputToCents(adultSaleIncl);
            return Number.isFinite(c) && c >= 0 ? c : null;
          })()
        : null;
    return JSON.stringify({
      ...adult,
      purchase_cents: adultPurchase.trim() ? purchase_cents : null,
      sale_cents
    });
  }, [adult, adultPurchase, adultSaleIncl]);

  function toggleSize(list: string[], size: string, on: boolean): string[] {
    const s = new Set(list);
    if (on) s.add(size);
    else s.delete(size);
    return [...s];
  }

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="productDetailsJson" value={productDetailsJson} readOnly />
      <input type="hidden" name="variantYouthJson" value={variantYouthJson} readOnly />
      <input type="hidden" name="variantAdultJson" value={variantAdultJson} readOnly />

      <label className="block md:col-span-2">
        <span className="text-sm text-zinc-700">Naam</span>
        <input name="name" required defaultValue={d.name} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>
      <label className="block md:col-span-2">
        <span className="text-sm text-zinc-700">Slug (optioneel)</span>
        <input name="slug" defaultValue={d.slug} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>

      <label className="block md:col-span-2">
        <span className="text-sm text-zinc-700">Tijdelijke korting (% op verkoopprijs incl. btw)</span>
        <input
          name="discountPercent"
          type="number"
          min={0}
          max={100}
          step={0.1}
          defaultValue={d.temporaryDiscountPercent}
          className="mt-1 w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-zinc-500">
          Geldt voor zowel Jeugd als Volwassenen. Op overzicht en productpagina: lintje &quot;EXTRA KORTING&quot;.
        </span>
      </label>

      <div className="flex items-center gap-3 md:col-span-2">
        <span className="text-sm text-zinc-700">Actief in shop</span>
        <label className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" name="active" value="on" defaultChecked={d.active} className="peer sr-only" />
          <span className="h-7 w-12 rounded-full bg-zinc-300 transition peer-checked:bg-brand-blue peer-focus:ring-2 peer-focus:ring-brand-blue/40" />
          <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </label>
      </div>

      <label className="block md:col-span-2">
        <span className="text-sm text-zinc-700">Categorie</span>
        <select name="categoryId" defaultValue={d.categoryId ?? ""} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
          <option value="">(geen)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block md:col-span-2">
        <span className="text-sm text-zinc-700">Productbeschrijving</span>
        <textarea
          name="description"
          rows={6}
          defaultValue={d.description ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="md:col-span-2 space-y-2">
        <span className="text-sm font-medium text-zinc-800">Productdetails (bijv. kleur, materiaal, pasvorm)</span>
        {details.map((row, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              className="min-w-[120px] flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              placeholder="Label"
              value={row.label}
              onChange={(e) => {
                const next = [...details];
                next[i] = { ...next[i], label: e.target.value };
                setDetails(next);
              }}
            />
            <input
              className="min-w-[160px] flex-[2] rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              placeholder="Waarde"
              value={row.value}
              onChange={(e) => {
                const next = [...details];
                next[i] = { ...next[i], value: e.target.value };
                setDetails(next);
              }}
            />
            <button
              type="button"
              className="text-sm text-red-600 hover:underline"
              onClick={() => setDetails(details.filter((_, j) => j !== i))}
            >
              Verwijder
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-medium text-brand-blue hover:underline"
          onClick={() => setDetails([...details, { label: "", value: "" }])}
        >
          + Detail toevoegen
        </button>
      </div>

      <p className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
        <strong className="font-semibold">Verkoopprijs per variant:</strong> vul bij Jeugd en/of Volwassenen de verkoopprijs in (incl./excl. 21% btw). Minstens één van beide varianten moet een verkoopprijs hebben. De tijdelijke korting hierboven geldt voor beide prijzen.
      </p>

      <VariantBlock
        title="Jeugd (YOUTH)"
        sizes={YOUTH_SIZE_OPTIONS as unknown as string[]}
        model={youth.model_number ?? ""}
        onModelChange={(v) => setYouth({ ...youth, model_number: v })}
        selected={youth.sizes ?? []}
        onToggle={(size, on) => setYouth({ ...youth, sizes: toggleSize(youth.sizes ?? [], size, on) })}
        purchaseStr={youthPurchase}
        onPurchaseChange={setYouthPurchase}
        saleInclStr={youthSaleIncl}
        saleExclStr={youthSaleExcl}
        onSaleInclChange={setYouthSaleIncl}
        onSaleExclChange={setYouthSaleExcl}
        onSaleInclBlur={() => {
          const c = nlInputToCents(youthSaleIncl);
          if (Number.isFinite(c) && c >= 0) setYouthSaleExcl(centsToNlInput(exclCentsFromIncl21(c)));
        }}
        onSaleExclBlur={() => {
          const c = nlInputToCents(youthSaleExcl);
          if (Number.isFinite(c) && c >= 0) setYouthSaleIncl(centsToNlInput(inclCentsFromExcl21(c)));
        }}
      />

      <VariantBlock
        title="Volwassenen (ADULT)"
        sizes={ADULT_SIZE_OPTIONS as unknown as string[]}
        model={adult.model_number ?? ""}
        onModelChange={(v) => setAdult({ ...adult, model_number: v })}
        selected={adult.sizes ?? []}
        onToggle={(size, on) => setAdult({ ...adult, sizes: toggleSize(adult.sizes ?? [], size, on) })}
        purchaseStr={adultPurchase}
        onPurchaseChange={setAdultPurchase}
        saleInclStr={adultSaleIncl}
        saleExclStr={adultSaleExcl}
        onSaleInclChange={setAdultSaleIncl}
        onSaleExclChange={setAdultSaleExcl}
        onSaleInclBlur={() => {
          const c = nlInputToCents(adultSaleIncl);
          if (Number.isFinite(c) && c >= 0) setAdultSaleExcl(centsToNlInput(exclCentsFromIncl21(c)));
        }}
        onSaleExclBlur={() => {
          const c = nlInputToCents(adultSaleExcl);
          if (Number.isFinite(c) && c >= 0) setAdultSaleIncl(centsToNlInput(inclCentsFromExcl21(c)));
        }}
      />

      {showImageUpload ? (
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Hoofdfoto (verplicht)</span>
          <input name="image" type="file" accept="image/*" required className="mt-1 block w-full text-sm" />
          <span className="mt-1 block text-xs text-zinc-500">
            Extra foto&apos;s kun je daarna op de bewerkpagina toevoegen (optioneel).
          </span>
        </label>
      ) : null}

      <div className="md:col-span-2">
        <button className="rounded-md bg-brand-blue px-4 py-2.5 text-sm font-medium text-white" type="submit">
          Opslaan
        </button>
      </div>
    </form>
  );
}

function VariantBlock({
  title,
  sizes,
  model,
  onModelChange,
  selected,
  onToggle,
  purchaseStr,
  onPurchaseChange,
  saleInclStr,
  saleExclStr,
  onSaleInclChange,
  onSaleExclChange,
  onSaleInclBlur,
  onSaleExclBlur
}: {
  title: string;
  sizes: string[];
  model: string;
  onModelChange: (v: string) => void;
  selected: string[];
  onToggle: (size: string, on: boolean) => void;
  purchaseStr: string;
  onPurchaseChange: (v: string) => void;
  saleInclStr: string;
  saleExclStr: string;
  onSaleInclChange: (v: string) => void;
  onSaleExclChange: (v: string) => void;
  onSaleInclBlur: () => void;
  onSaleExclBlur: () => void;
}) {
  return (
    <div className="md:col-span-2 rounded-lg border border-zinc-200 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>

      <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
        <p className="text-xs font-medium text-zinc-800">Verkoopprijs (incl. en excl. 21% btw)</p>
        <p className="mt-0.5 text-xs text-zinc-600">Vul één van de twee velden in; het andere wordt berekend.</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-zinc-600">Verkoopprijs incl. btw (€)</span>
            <input
              value={saleInclStr}
              onChange={(e) => onSaleInclChange(e.target.value)}
              onBlur={onSaleInclBlur}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              placeholder="42,30"
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-600">Verkoopprijs excl. btw (€)</span>
            <input
              value={saleExclStr}
              onChange={(e) => onSaleExclChange(e.target.value)}
              onBlur={onSaleExclBlur}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              placeholder="34,96"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-600">Inkoopprijs (€)</span>
          <input
            value={purchaseStr}
            onChange={(e) => onPurchaseChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="0,00"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-600">Modelnummer (alleen intern — niet zichtbaar in de shop)</span>
          <input
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <p className="mt-4 text-xs font-medium text-zinc-700">Beschikbare maten</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {sizes.map((sz) => (
          <label key={sz} className="flex cursor-pointer items-center gap-1.5 rounded border border-zinc-200 px-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(sz)}
              onChange={(e) => onToggle(sz, e.target.checked)}
            />
            {sz}
          </label>
        ))}
      </div>
    </div>
  );
}
