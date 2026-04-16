"use client";

import { useState } from "react";
import { ProductEditorForm } from "@/components/dashboard/ProductEditorForm";
import { ProductReorderRulesDraftEditor } from "@/components/dashboard/ProductReorderRulesDraftEditor";

type Cat = { id: string; name: string };

export function NewProductPageClient({
  action,
  categories
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: Cat[];
}) {
  const [garmentType, setGarmentType] = useState<"clothing" | "socks" | "shoes">("clothing");

  return (
    <ProductEditorForm
      action={action}
      categories={categories}
      defaults={{ printingExclCents: 0, garmentType }}
      showImageUpload
      garmentTypeValue={garmentType}
      onGarmentTypeChange={setGarmentType}
      childrenBeforeSubmit={<ProductReorderRulesDraftEditor garmentType={garmentType} />}
    />
  );
}

