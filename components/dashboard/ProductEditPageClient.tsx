"use client";

import { useState } from "react";
import { ProductEditorForm } from "@/components/dashboard/ProductEditorForm";
import { ProductReorderRulesEditor, type ExistingRule } from "@/components/dashboard/ProductReorderRulesEditor";

type Cat = { id: string; name: string };

export function ProductEditPageClient({
  productId,
  categories,
  defaults,
  reorderRules,
  updateProductAction,
  updateReorderRulesAction,
  syncVariantSizesAction,
  setInactiveAction,
  deleteHardAction
}: {
  productId: string;
  categories: Cat[];
  defaults: {
    name: string;
    slug: string;
    description: string | null;
    temporaryDiscountPercent: number;
    printingExclCents: number;
    active: boolean;
    categoryId: string | null;
    garmentType: "clothing" | "socks" | "shoes" | "onesize";
    productDetails: any[];
    variantYouth: any;
    variantAdult: any;
    variantSocks?: any;
    variantShoes?: any;
    variantOneSize?: any;
  };
  reorderRules: ExistingRule[];
  updateProductAction: (formData: FormData) => void | Promise<void>;
  updateReorderRulesAction: (formData: FormData) => void | Promise<void>;
  syncVariantSizesAction: () => void | Promise<void>;
  setInactiveAction: () => void | Promise<void>;
  deleteHardAction: () => void | Promise<void>;
}) {
  const [garmentType, setGarmentType] = useState<"clothing" | "socks" | "shoes" | "onesize">(defaults.garmentType);

  return (
    <div className="space-y-10">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Product acties</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Normaal gesproken zet je een product <strong>inactief</strong> zodat het niet meer zichtbaar is in de shop.
          Definitief verwijderen is alleen bedoeld voor foutief ingevoerde producten en kan niet als er al data gekoppeld is.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={setInactiveAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              onClick={(e) => {
                if (!window.confirm("Weet je zeker dat je dit product inactief wilt zetten?")) e.preventDefault();
              }}
            >
              Product op inactief zetten
            </button>
          </form>
          <form action={deleteHardAction}>
            <button
              type="submit"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
              onClick={(e) => {
                const ok = window.confirm(
                  "LET OP: Dit verwijdert het product definitief en alle data kan verloren gaan.\n\nGebruik dit alleen voor foutief ingevoerde producten.\n\nDoorgaan?"
                );
                if (!ok) e.preventDefault();
              }}
            >
              Product definitief verwijderen
            </button>
          </form>
        </div>
      </div>

      <div>
        <ProductEditorForm
          action={updateProductAction}
          categories={categories}
          defaults={defaults}
          garmentTypeValue={garmentType}
          onGarmentTypeChange={setGarmentType}
        />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Voorraad instellingen per maat</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Activeer maten en stel een drempelwaarde en standaard voorraad in. Als de actuele voorraad van een maat op of onder
          de drempel komt, verschijnt er automatisch een aanvulregel in <strong>Nieuwe leveranciersbestelling</strong>.
        </p>
        <div className="mt-4">
          <ProductReorderRulesEditor
            productId={productId}
            garmentType={garmentType}
            existing={reorderRules}
            action={updateReorderRulesAction}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="text-sm text-zinc-700">
            Zie je in de shop geen maatknoppen? Dan is waarschijnlijk de matenlijst op het product leeg. Dit zet de actieve
            maten uit de voorraadregels terug naar het product.
          </div>
          <form action={syncVariantSizesAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Sync maten vanuit voorraadregels
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

