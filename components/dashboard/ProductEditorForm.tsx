"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { exclCentsFromIncl21, inclCentsFromExcl21, parseDutchEuroToCents } from "@/lib/money/nl-euro";
import type { ProductDetailRow, ProductSetComponentInput, ProductVariantBlock } from "@/lib/validation/products";

export type SetComponentOption = { id: string; name: string };

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
  printingExclCents: number;
  allowJerseyNumber: boolean;
  jerseyNumberSaleCents: number;
  jerseyNumberPurchaseSingleExclCents: number;
  jerseyNumberPurchaseDoubleExclCents: number;
  active: boolean;
  categoryId: string | null;
  /** Kleding: jeugd/volwassen maatlijsten; sokken: vaste sokkenmaten onder voorraad per maat. */
  garmentType: "clothing" | "socks" | "shoes" | "onesize";
  productDetails: ProductDetailRow[];
  variantYouth: ProductVariantBlock;
  variantAdult: ProductVariantBlock;
  variantSocks: ProductVariantBlock;
  variantShoes: ProductVariantBlock;
  variantOneSize: ProductVariantBlock;
  isSet: boolean;
  setSalePriceInclCents: number;
  setComponents: ProductSetComponentInput[];
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
  showImageUpload = false,
  garmentTypeValue,
  onGarmentTypeChange,
  setComponentOptions = [],
  childrenBeforeSubmit
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: Cat[];
  defaults?: Partial<Defaults>;
  showImageUpload?: boolean;
  /** Optioneel: controlled garment type (voor live-sync met voorraadregels). */
  garmentTypeValue?: "clothing" | "socks" | "shoes" | "onesize";
  onGarmentTypeChange?: (v: "clothing" | "socks" | "shoes" | "onesize") => void;
  /** Mogelijke component-producten voor een productset (niet zichzelf, geen andere sets). */
  setComponentOptions?: SetComponentOption[];
  /** Optioneel: extra content binnen het <form> (voor bijv. voorraadregels bij nieuw product). */
  childrenBeforeSubmit?: ReactNode;
}) {
  const d: Defaults = {
    name: defaults?.name ?? "",
    slug: defaults?.slug ?? "",
    description: defaults?.description ?? "",
    temporaryDiscountPercent: defaults?.temporaryDiscountPercent ?? 0,
    printingExclCents: defaults?.printingExclCents ?? 0,
    allowJerseyNumber: (defaults as any)?.allowJerseyNumber ?? false,
    jerseyNumberSaleCents: Number((defaults as any)?.jerseyNumberSaleCents ?? 0),
    jerseyNumberPurchaseSingleExclCents: Number((defaults as any)?.jerseyNumberPurchaseSingleExclCents ?? 0),
    jerseyNumberPurchaseDoubleExclCents: Number((defaults as any)?.jerseyNumberPurchaseDoubleExclCents ?? 0),
    active: defaults?.active ?? true,
    categoryId: defaults?.categoryId ?? null,
    garmentType: defaults?.garmentType ?? "clothing",
    productDetails: defaults?.productDetails ?? [],
    variantYouth: defaults?.variantYouth ?? emptyVariant(),
    variantAdult: defaults?.variantAdult ?? emptyVariant(),
    variantSocks: (defaults as any)?.variantSocks ?? emptyVariant(),
    variantShoes: (defaults as any)?.variantShoes ?? emptyVariant(),
    variantOneSize: (defaults as any)?.variantOneSize ?? emptyVariant(),
    isSet: (defaults as any)?.isSet ?? false,
    setSalePriceInclCents: Number((defaults as any)?.setSalePriceInclCents ?? 0),
    setComponents: ((defaults as any)?.setComponents ?? []) as ProductSetComponentInput[]
  };

  // Verplichte categorie: alleen een id uit de huidige lijst als default; anders eerste optie (nooit leeg als er categorieën zijn).
  const categorySelectDefault =
    d.categoryId && categories.some((c) => c.id === d.categoryId)
      ? d.categoryId
      : (categories[0]?.id ?? "");

  const [details, setDetails] = useState<ProductDetailRow[]>(d.productDetails);
  const [youth, setYouth] = useState<ProductVariantBlock>(d.variantYouth);
  const [adult, setAdult] = useState<ProductVariantBlock>(d.variantAdult);
  const [printingExclEuro, setPrintingExclEuro] = useState(() => centsToNlInput(Math.max(0, d.printingExclCents ?? 0)));
  const [allowJerseyNumber, setAllowJerseyNumber] = useState<boolean>(Boolean(d.allowJerseyNumber));
  const [jerseySaleIncl, setJerseySaleIncl] = useState(() => centsToNlInput(Math.max(0, d.jerseyNumberSaleCents ?? 0)));
  const [jerseyPurchaseSingleExcl, setJerseyPurchaseSingleExcl] = useState(() =>
    centsToNlInput(Math.max(0, d.jerseyNumberPurchaseSingleExclCents ?? 0))
  );
  const [jerseyPurchaseDoubleExcl, setJerseyPurchaseDoubleExcl] = useState(() =>
    centsToNlInput(Math.max(0, d.jerseyNumberPurchaseDoubleExclCents ?? 0))
  );
  const [socks, setSocks] = useState<ProductVariantBlock>(d.variantSocks);
  const [shoes, setShoes] = useState<ProductVariantBlock>(d.variantShoes);
  const [one, setOne] = useState<ProductVariantBlock>(d.variantOneSize);

  const [garmentTypeInternal, setGarmentTypeInternal] = useState<"clothing" | "socks" | "shoes" | "onesize">(d.garmentType as any);
  const garmentType = garmentTypeValue ?? garmentTypeInternal;

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
    const sale_cents =
      youthSaleIncl.trim().length > 0
        ? (() => {
            const c = nlInputToCents(youthSaleIncl);
            return Number.isFinite(c) && c >= 0 ? c : null;
          })()
        : null;
    return JSON.stringify({
      ...youth,
      sale_cents
    });
  }, [youth, youthSaleIncl]);

  const variantAdultJson = useMemo(() => {
    const sale_cents =
      adultSaleIncl.trim().length > 0
        ? (() => {
            const c = nlInputToCents(adultSaleIncl);
            return Number.isFinite(c) && c >= 0 ? c : null;
          })()
        : null;
    return JSON.stringify({
      ...adult,
      sale_cents
    });
  }, [adult, adultSaleIncl]);

  const [socksSaleIncl, setSocksSaleIncl] = useState(() => centsToOptionalNl(d.variantSocks.sale_cents));
  const [socksSaleExcl, setSocksSaleExcl] = useState(() => saleExclFromInclCents(d.variantSocks.sale_cents ?? null));

  const variantSocksJson = useMemo(() => {
    const sale_cents =
      socksSaleIncl.trim().length > 0
        ? (() => {
            const c = nlInputToCents(socksSaleIncl);
            return Number.isFinite(c) && c >= 0 ? c : null;
          })()
        : null;
    return JSON.stringify({
      ...socks,
      sale_cents
    });
  }, [socks, socksSaleIncl]);

  const [shoesSaleIncl, setShoesSaleIncl] = useState(() => centsToOptionalNl(d.variantShoes.sale_cents));
  const [shoesSaleExcl, setShoesSaleExcl] = useState(() => saleExclFromInclCents(d.variantShoes.sale_cents ?? null));

  const variantShoesJson = useMemo(() => {
    const sale_cents =
      shoesSaleIncl.trim().length > 0
        ? (() => {
            const c = nlInputToCents(shoesSaleIncl);
            return Number.isFinite(c) && c >= 0 ? c : null;
          })()
        : null;
    return JSON.stringify({
      ...shoes,
      sale_cents
    });
  }, [shoes, shoesSaleIncl]);

  const [oneSaleIncl, setOneSaleIncl] = useState(() => centsToOptionalNl(d.variantOneSize.sale_cents));
  const [oneSaleExcl, setOneSaleExcl] = useState(() => saleExclFromInclCents(d.variantOneSize.sale_cents ?? null));

  const variantOneSizeJson = useMemo(() => {
    const sale_cents =
      oneSaleIncl.trim().length > 0
        ? (() => {
            const c = nlInputToCents(oneSaleIncl);
            return Number.isFinite(c) && c >= 0 ? c : null;
          })()
        : null;
    return JSON.stringify({
      ...one,
      sale_cents
    });
  }, [one, oneSaleIncl]);

  const printingExclCents = useMemo(() => {
    const c = nlInputToCents(printingExclEuro);
    return Number.isFinite(c) && c >= 0 ? c : 0;
  }, [printingExclEuro]);

  const jerseyNumberSaleCents = useMemo(() => {
    const c = nlInputToCents(jerseySaleIncl);
    return Number.isFinite(c) && c >= 0 ? c : 0;
  }, [jerseySaleIncl]);
  const jerseyNumberPurchaseSingleExclCents = useMemo(() => {
    const c = nlInputToCents(jerseyPurchaseSingleExcl);
    return Number.isFinite(c) && c >= 0 ? c : 0;
  }, [jerseyPurchaseSingleExcl]);
  const jerseyNumberPurchaseDoubleExclCents = useMemo(() => {
    const c = nlInputToCents(jerseyPurchaseDoubleExcl);
    return Number.isFinite(c) && c >= 0 ? c : 0;
  }, [jerseyPurchaseDoubleExcl]);

  const [isSet, setIsSet] = useState<boolean>(Boolean(d.isSet));
  const [setSaleIncl, setSetSaleIncl] = useState(() => centsToNlInput(Math.max(0, d.setSalePriceInclCents ?? 0)));
  const [setComponents, setSetComponents] = useState<ProductSetComponentInput[]>(
    (d.setComponents ?? []).map((c, i) => ({
      componentProductId: c.componentProductId,
      quantity: c.quantity,
      sortOrder: c.sortOrder ?? i,
      note: c.note ?? "",
      optionGroup: (c as any).optionGroup ?? "",
      optionGroupLabel: (c as any).optionGroupLabel ?? ""
    }))
  );
  const setComponentsJson = useMemo(
    () =>
      JSON.stringify(
        setComponents.map((c, i) => ({
          componentProductId: c.componentProductId,
          quantity: Number(c.quantity) || 1,
          sortOrder: c.sortOrder ?? i,
          note: (c.note ?? "").trim(),
          optionGroup: (c.optionGroup ?? "").trim(),
          optionGroupLabel: (c.optionGroupLabel ?? "").trim()
        }))
      ),
    [setComponents]
  );

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="productDetailsJson" value={productDetailsJson} readOnly />
      <input type="hidden" name="variantYouthJson" value={variantYouthJson} readOnly />
      <input type="hidden" name="variantAdultJson" value={variantAdultJson} readOnly />
      <input type="hidden" name="variantSocksJson" value={variantSocksJson} readOnly />
      <input type="hidden" name="variantShoesJson" value={variantShoesJson} readOnly />
      <input type="hidden" name="variantOneSizeJson" value={variantOneSizeJson} readOnly />
      <input type="hidden" name="printingExclCents" value={String(printingExclCents)} readOnly />
      <input type="hidden" name="allowJerseyNumber" value={allowJerseyNumber ? "on" : ""} readOnly />
      <input type="hidden" name="jerseyNumberSaleCents" value={String(jerseyNumberSaleCents)} readOnly />
      <input
        type="hidden"
        name="jerseyNumberPurchaseSingleExclCents"
        value={String(jerseyNumberPurchaseSingleExclCents)}
        readOnly
      />
      <input
        type="hidden"
        name="jerseyNumberPurchaseDoubleExclCents"
        value={String(jerseyNumberPurchaseDoubleExclCents)}
        readOnly
      />
      <input type="hidden" name="isSet" value={isSet ? "on" : ""} readOnly />
      <input type="hidden" name="setSaleInclEuro" value={setSaleIncl} readOnly />
      <input type="hidden" name="setComponentsJson" value={setComponentsJson} readOnly />

      <fieldset className="md:col-span-2 rounded-lg border border-zinc-200 p-4">
        <legend className="px-1 text-sm font-medium text-zinc-800">Productset</legend>
        <p className="mb-3 text-xs text-zinc-600">
          Een set is een bundel van bestaande producten met een eigen verkoopprijs. Maten en voorraad worden per
          component beheerd; de set zelf heeft alleen een verkoopprijs.
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={isSet}
            onChange={(e) => setIsSet(e.target.checked)}
            className="h-4 w-4 border-zinc-300 text-brand-blue focus:ring-brand-blue/40"
          />
          Dit product is een set/bundel
        </label>

        {isSet ? (
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm text-zinc-700">Verkoopprijs set (incl. btw)</span>
              <div className="mt-1 flex max-w-xs items-center gap-2">
                <span className="text-sm text-zinc-500">€</span>
                <input
                  value={setSaleIncl}
                  onChange={(e) => setSetSaleIncl(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="0,00"
                />
              </div>
            </label>

            <div className="space-y-3">
              <span className="text-sm font-medium text-zinc-800">Componenten</span>
              <p className="text-xs text-zinc-600">
                Vul een <strong>keuzegroep</strong> (interne key, bv. <code>bovenlaag</code>) om componenten als
                alternatieven aan te bieden — de klant kiest dan precies één van die items. Leeg laten betekent dat het
                component altijd in de set zit. Het <strong>publieke label</strong> is wat in de webshop boven de
                keuze wordt getoond (bv. "Kies je bovenlaag"). Vul dit label op één regel van de groep in; alle
                regels met dezelfde keuzegroep krijgen hetzelfde label.
              </p>
              {setComponentOptions.length === 0 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Sla het product eerst op om componenten te kunnen kiezen, of er zijn nog geen andere producten om uit te
                  kiezen.
                </p>
              ) : null}
              {setComponents.map((row, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
                  <label className="min-w-[220px] flex-1">
                    <span className="block text-xs text-zinc-600">Component</span>
                    <select
                      value={row.componentProductId}
                      onChange={(e) => {
                        const next = [...setComponents];
                        next[i] = { ...next[i], componentProductId: e.target.value };
                        setSetComponents(next);
                      }}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">— kies component —</option>
                      {setComponentOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-24">
                    <span className="block text-xs text-zinc-600">Aantal</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={row.quantity}
                      onChange={(e) => {
                        const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                        const next = [...setComponents];
                        next[i] = { ...next[i], quantity: n };
                        setSetComponents(next);
                      }}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="w-36">
                    <span className="block text-xs text-zinc-600">Keuzegroep (key, optioneel)</span>
                    <input
                      value={row.optionGroup ?? ""}
                      onChange={(e) => {
                        const next = [...setComponents];
                        next[i] = { ...next[i], optionGroup: e.target.value };
                        setSetComponents(next);
                      }}
                      placeholder="bijv. bovenlaag"
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="min-w-[180px] flex-1">
                    <span className="block text-xs text-zinc-600">Publiek label (optioneel)</span>
                    <input
                      value={row.optionGroupLabel ?? ""}
                      onChange={(e) => {
                        const next = [...setComponents];
                        next[i] = { ...next[i], optionGroupLabel: e.target.value };
                        setSetComponents(next);
                      }}
                      placeholder='bijv. "Kies je bovenlaag"'
                      disabled={!String(row.optionGroup ?? "").trim()}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                    />
                  </label>
                  <label className="min-w-[160px] flex-1">
                    <span className="block text-xs text-zinc-600">Toelichting (optioneel)</span>
                    <input
                      value={row.note ?? ""}
                      onChange={(e) => {
                        const next = [...setComponents];
                        next[i] = { ...next[i], note: e.target.value };
                        setSetComponents(next);
                      }}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    className="text-sm text-red-700 hover:underline"
                    onClick={() => setSetComponents(setComponents.filter((_, j) => j !== i))}
                  >
                    Verwijder
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-medium text-brand-blue hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                disabled={setComponentOptions.length === 0}
                onClick={() =>
                  setSetComponents([
                    ...setComponents,
                    {
                      componentProductId: "",
                      quantity: 1,
                      sortOrder: setComponents.length,
                      note: "",
                      optionGroup: "",
                      optionGroupLabel: ""
                    }
                  ])
                }
              >
                + Component toevoegen
              </button>
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset
        disabled={isSet}
        className={`md:col-span-2 rounded-lg border border-zinc-200 p-4 ${isSet ? "opacity-60" : ""}`}
      >
        <legend className="px-1 text-sm font-medium text-zinc-800">Kledingsoort</legend>
        <p className="mb-3 text-xs text-zinc-600">
          {isSet
            ? "Niet relevant voor sets — maten worden per component bepaald."
            : "Kies de kledingsoort voor dit product."}
        </p>
        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="garmentType"
              value="clothing"
              checked={garmentType === "clothing"}
              onChange={() => {
                setGarmentTypeInternal("clothing");
                onGarmentTypeChange?.("clothing");
              }}
              className="h-4 w-4 border-zinc-300 text-brand-blue focus:ring-brand-blue/40"
            />
            Kleding
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="garmentType"
              value="socks"
              checked={garmentType === "socks"}
              onChange={() => {
                setGarmentTypeInternal("socks");
                onGarmentTypeChange?.("socks");
              }}
              className="h-4 w-4 border-zinc-300 text-brand-blue focus:ring-brand-blue/40"
            />
            Sokken
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="garmentType"
              value="shoes"
              checked={garmentType === "shoes"}
              onChange={() => {
                setGarmentTypeInternal("shoes");
                onGarmentTypeChange?.("shoes");
              }}
              className="h-4 w-4 border-zinc-300 text-brand-blue focus:ring-brand-blue/40"
            />
            Schoenen
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="garmentType"
              value="onesize"
              checked={garmentType === "onesize"}
              onChange={() => {
                setGarmentTypeInternal("onesize");
                onGarmentTypeChange?.("onesize");
              }}
              className="h-4 w-4 border-zinc-300 text-brand-blue focus:ring-brand-blue/40"
            />
            One Size
          </label>
        </div>
      </fieldset>

      {!isSet ? (
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Kosten bedrukking (excl. btw)</span>
          <div className="mt-1 flex max-w-xs items-center gap-2">
            <span className="text-sm text-zinc-500">€</span>
            <input
              name="printingExclEuro"
              value={printingExclEuro}
              onChange={(e) => setPrintingExclEuro(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="0,00"
            />
          </div>
        </label>
      ) : null}

      {!isSet && garmentType === "clothing" ? (
        <fieldset className="md:col-span-2 rounded-lg border border-zinc-200 p-4">
          <legend className="px-1 text-sm font-medium text-zinc-800">Rugnummer (optioneel)</legend>
          <div className="mt-1 flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={allowJerseyNumber}
                onChange={(e) => setAllowJerseyNumber(e.target.checked)}
                className="h-4 w-4 border-zinc-300 text-brand-blue focus:ring-brand-blue/40"
              />
              Mogelijkheid rugnummer
            </label>

            {allowJerseyNumber ? (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block">
                  <span className="text-sm text-zinc-700">Verkoopprijs rugnummer (incl. btw)</span>
                  <div className="mt-1 flex max-w-xs items-center gap-2">
                    <span className="text-sm text-zinc-500">€</span>
                    <input
                      value={jerseySaleIncl}
                      onChange={(e) => setJerseySaleIncl(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm text-zinc-700">Inkoopprijs enkel (1-9) (excl. btw)</span>
                  <div className="mt-1 flex max-w-xs items-center gap-2">
                    <span className="text-sm text-zinc-500">€</span>
                    <input
                      value={jerseyPurchaseSingleExcl}
                      onChange={(e) => setJerseyPurchaseSingleExcl(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm text-zinc-700">Inkoopprijs dubbel (10+) (excl. btw)</span>
                  <div className="mt-1 flex max-w-xs items-center gap-2">
                    <span className="text-sm text-zinc-500">€</span>
                    <input
                      value={jerseyPurchaseDoubleExcl}
                      onChange={(e) => setJerseyPurchaseDoubleExcl(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                </label>
              </div>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      <label className="block md:col-span-2">
        <span className="text-sm text-zinc-700">Naam product</span>
        <input name="name" required defaultValue={d.name} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>
      <label className="block md:col-span-2">
        <span className="text-sm text-zinc-700">Slug (.nl/naam_product)</span>
        <input name="slug" defaultValue={d.slug} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>

      <label className="block md:col-span-2">
        <span className="text-sm text-zinc-700">Tijdelijke korting (in %).</span>
        <input
          name="discountPercent"
          type="number"
          min={0}
          max={100}
          step={0.1}
          defaultValue={d.temporaryDiscountPercent}
          className="mt-1 w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
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
        <span className="text-sm text-zinc-700">Categorie (verplicht)</span>
        {categories.length === 0 ? (
          <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Er zijn nog geen categorieën. Maak eerst categorieën aan onder Dashboard → Producten → Categorieën (of voer de seed-migratie uit), daarna kun je een product opslaan.
          </p>
        ) : (
          <select
            name="categoryId"
            defaultValue={categorySelectDefault}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
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

      {!isSet && garmentType === "clothing" ? (
        <>
          <VariantBlock
            title="Jeugd (YOUTH)"
            model={youth.model_number ?? ""}
            onModelChange={(v) => setYouth({ ...youth, model_number: v })}
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
            model={adult.model_number ?? ""}
            onModelChange={(v) => setAdult({ ...adult, model_number: v })}
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
        </>
      ) : !isSet && garmentType === "socks" ? (
        <VariantBlock
          title="Sokken (SOCKS)"
          model={socks.model_number ?? ""}
          onModelChange={(v) => setSocks({ ...socks, model_number: v })}
          saleInclStr={socksSaleIncl}
          saleExclStr={socksSaleExcl}
          onSaleInclChange={setSocksSaleIncl}
          onSaleExclChange={setSocksSaleExcl}
          onSaleInclBlur={() => {
            const c = nlInputToCents(socksSaleIncl);
            if (Number.isFinite(c) && c >= 0) setSocksSaleExcl(centsToNlInput(exclCentsFromIncl21(c)));
          }}
          onSaleExclBlur={() => {
            const c = nlInputToCents(socksSaleExcl);
            if (Number.isFinite(c) && c >= 0) setSocksSaleIncl(centsToNlInput(inclCentsFromExcl21(c)));
          }}
        />
      ) : !isSet && garmentType === "shoes" ? (
        <VariantBlock
          title="Schoenen (SHOES)"
          model={shoes.model_number ?? ""}
          onModelChange={(v) => setShoes({ ...shoes, model_number: v })}
          saleInclStr={shoesSaleIncl}
          saleExclStr={shoesSaleExcl}
          onSaleInclChange={setShoesSaleIncl}
          onSaleExclChange={setShoesSaleExcl}
          onSaleInclBlur={() => {
            const c = nlInputToCents(shoesSaleIncl);
            if (Number.isFinite(c) && c >= 0) setShoesSaleExcl(centsToNlInput(exclCentsFromIncl21(c)));
          }}
          onSaleExclBlur={() => {
            const c = nlInputToCents(shoesSaleExcl);
            if (Number.isFinite(c) && c >= 0) setShoesSaleIncl(centsToNlInput(inclCentsFromExcl21(c)));
          }}
        />
      ) : !isSet ? (
        <VariantBlock
          title="One Size"
          model={one.model_number ?? ""}
          onModelChange={(v) => setOne({ ...one, model_number: v })}
          saleInclStr={oneSaleIncl}
          saleExclStr={oneSaleExcl}
          onSaleInclChange={setOneSaleIncl}
          onSaleExclChange={setOneSaleExcl}
          onSaleInclBlur={() => {
            const c = nlInputToCents(oneSaleIncl);
            if (Number.isFinite(c) && c >= 0) setOneSaleExcl(centsToNlInput(exclCentsFromIncl21(c)));
          }}
          onSaleExclBlur={() => {
            const c = nlInputToCents(oneSaleExcl);
            if (Number.isFinite(c) && c >= 0) setOneSaleIncl(centsToNlInput(inclCentsFromExcl21(c)));
          }}
        />
      ) : null}

      {showImageUpload ? (
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Hoofdfoto (verplicht)</span>
          <input name="image" type="file" accept="image/*" required className="mt-1 block w-full text-sm" />
          <span className="mt-1 block text-xs text-zinc-500">
            Extra foto&apos;s kun je daarna op de bewerkpagina toevoegen (optioneel).
          </span>
        </label>
      ) : null}

      {childrenBeforeSubmit ? <div className="md:col-span-2">{childrenBeforeSubmit}</div> : null}

      <div className="md:col-span-2">
        <button
          className="rounded-md bg-brand-blue px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={categories.length === 0}
        >
          Opslaan
        </button>
      </div>
    </form>
  );
}

function VariantBlock({
  title,
  model,
  onModelChange,
  saleInclStr,
  saleExclStr,
  onSaleInclChange,
  onSaleExclChange,
  onSaleInclBlur,
  onSaleExclBlur
}: {
  title: string;
  model: string;
  onModelChange: (v: string) => void;
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
        <p className="text-xs text-zinc-800">
          <strong className="font-semibold">Verkoopprijs</strong>
        </p>
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

      <label className="mt-3 block">
        <span className="text-xs text-zinc-600">Artikelnummer</span>
        <input
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <p className="mt-4 text-xs text-zinc-600">
        Beschikbare maten beheer je hieronder bij <strong>Voorraad instellingen per maat</strong>.
      </p>
    </div>
  );
}
