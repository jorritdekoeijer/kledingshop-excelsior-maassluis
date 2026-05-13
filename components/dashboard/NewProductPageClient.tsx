"use client";

import { useState } from "react";
import { ProductEditorForm, type SetComponentOption } from "@/components/dashboard/ProductEditorForm";
import { ProductReorderRulesDraftEditor } from "@/components/dashboard/ProductReorderRulesDraftEditor";

type Cat = { id: string; name: string };

export function NewProductPageClient({
  action,
  categories,
  setComponentOptions = []
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: Cat[];
  setComponentOptions?: SetComponentOption[];
}) {
  const [garmentType, setGarmentType] = useState<"clothing" | "socks" | "shoes" | "onesize">("clothing");

  return (
    <ProductEditorForm
      action={action}
      categories={categories}
      defaults={{ printingExclCents: 0, garmentType }}
      showImageUpload
      garmentTypeValue={garmentType}
      onGarmentTypeChange={setGarmentType}
      setComponentOptions={setComponentOptions}
      childrenBeforeSubmit={<ProductReorderRulesDraftEditor garmentType={garmentType} />}
    />
  );
}

