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
  updateReorderRulesAction
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
    garmentType: "clothing" | "socks";
    productDetails: any[];
    variantYouth: any;
    variantAdult: any;
  };
  reorderRules: ExistingRule[];
  updateProductAction: (formData: FormData) => void | Promise<void>;
  updateReorderRulesAction: (formData: FormData) => void | Promise<void>;
}) {
  const [garmentType, setGarmentType] = useState<"clothing" | "socks">(defaults.garmentType);

  return (
    <div className="space-y-10">
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
      </div>
    </div>
  );
}

