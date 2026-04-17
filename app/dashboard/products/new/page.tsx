import { redirect } from "next/navigation";
import { NewProductPageClient } from "@/components/dashboard/NewProductPageClient";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { productParsedToInsertRow } from "@/lib/dashboard/product-db-row";
import { parseProductUpsertFormData } from "@/lib/dashboard/product-form-parse";
import { resolveProductCategoryId } from "@/lib/dashboard/resolve-product-category-id";
import { PUBLIC_PRODUCT_CATEGORIES_TABLE } from "@/lib/db/public-tables";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { activeSizesInTemplateOrder, variantBlockToDbJson } from "@/lib/dashboard/product-db-row";
import { normalizeVariantBlock } from "@/lib/shop/product-json";
import { ADULT_SIZE_OPTIONS, SHOES_SIZE_OPTIONS, SOCKS_SIZE_OPTIONS, YOUTH_SIZE_OPTIONS } from "@/lib/products/variant-constants";
import { z } from "zod";
import { reorderRuleRowSchema } from "@/lib/validation/reorder-rules";

export const dynamic = "force-dynamic";

async function createProduct(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect("/dashboard/products?error=Geen%20toegang");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/dashboard/products/new?error=${encodeURIComponent("Hoofdfoto is verplicht. Kies een afbeelding om te uploaden.")}`
    );
  }

  const parsed = parseProductUpsertFormData(formData);
  if (!parsed.ok) {
    redirect(`/dashboard/products/new?error=${encodeURIComponent(parsed.message)}`);
  }

  const d = parsed.value;
  const service = createSupabaseServiceClient();

  const cat = await resolveProductCategoryId(service, d.categoryId);
  if (!cat.ok) {
    redirect(`/dashboard/products/new?error=${encodeURIComponent(cat.message)}`);
  }

  const { data: created, error } = await service
    .from("products")
    .insert(productParsedToInsertRow(d, cat.category_id))
    .select("id")
    .single();

  if (error || !created) {
    redirect(
      `/dashboard/products/new?error=${encodeURIComponent(error ? formatPostgrestError(error) : "Product aanmaken mislukt (geen id).")}`
    );
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `products/${created.id}.${ext}`;
  const upload = await service.storage.from("product-images").upload(path, file, { upsert: true, contentType: file.type });
  if (upload.error) redirect(`/dashboard/products/${created.id}/edit?error=${encodeURIComponent(upload.error.message)}`);
  await service.from("product_images").insert({ product_id: created.id, path, sort_order: 0, is_primary: true });

  // Voorraadregels (per maat) direct aanmaken op basis van de gekozen kledingsoort.
  const rawRules = formData.get("reorderRulesJson");
  if (typeof rawRules === "string" && rawRules.trim()) {
    let parsedRules: unknown = [];
    try {
      parsedRules = JSON.parse(rawRules);
    } catch {
      redirect(`/dashboard/products/new?error=${encodeURIComponent("Ongeldige voorraadregels (JSON).")}`);
    }
    const rulesArr = z.array(reorderRuleRowSchema).safeParse(parsedRules);
    if (!rulesArr.success) {
      redirect(
        `/dashboard/products/new?error=${encodeURIComponent(rulesArr.error.issues[0]?.message ?? "Ongeldige voorraadregels.")}`
      );
    }
    const rows = rulesArr.data
      .filter((r) => r.isActive)
      .map((r) => ({
        product_id: created.id,
        variant_segment: r.variantSegment,
        size_label: r.sizeLabel,
        is_active: r.isActive,
        threshold_qty: r.thresholdQty,
        target_qty: r.targetQty
      }));
    if (rows.length > 0) {
      const { error: rrErr } = await service.from("stock_reorder_rules").upsert(rows, {
        onConflict: "product_id,variant_segment,size_label"
      });
      if (rrErr) {
        redirect(`/dashboard/products/new?error=${encodeURIComponent(formatPostgrestError(rrErr))}`);
      }
    }

    // Sync actieve maten naar products.variant_*.sizes (shop leest die voor maatknoppen).
    const activeYouth = rulesArr.data.filter((r) => r.variantSegment === "youth" && r.isActive).map((r) => r.sizeLabel);
    const activeAdult = rulesArr.data.filter((r) => r.variantSegment === "adult" && r.isActive).map((r) => r.sizeLabel);
    const activeSocks = rulesArr.data.filter((r) => r.variantSegment === "socks" && r.isActive).map((r) => r.sizeLabel);
    const activeShoes = rulesArr.data.filter((r) => r.variantSegment === "shoes" && r.isActive).map((r) => r.sizeLabel);

    const youthSizes = activeSizesInTemplateOrder(activeYouth, YOUTH_SIZE_OPTIONS);
    const adultSizes = activeSizesInTemplateOrder(activeAdult, ADULT_SIZE_OPTIONS);
    const socksSizes = activeSizesInTemplateOrder(activeSocks, SOCKS_SIZE_OPTIONS);
    const shoesSizes = activeSizesInTemplateOrder(activeShoes, SHOES_SIZE_OPTIONS);

    const vy = normalizeVariantBlock((d as any).variantYouth);
    const va = normalizeVariantBlock((d as any).variantAdult);
    const vs = normalizeVariantBlock((d as any).variantSocks);
    const vh = normalizeVariantBlock((d as any).variantShoes);

    const { error: updErr } = await service
      .from("products")
      .update({
        variant_youth: variantBlockToDbJson({ ...vy, sizes: d.garmentType === "clothing" ? youthSizes : [] }),
        variant_adult: variantBlockToDbJson({ ...va, sizes: d.garmentType === "clothing" ? adultSizes : [] }),
        variant_socks: variantBlockToDbJson({ ...vs, sizes: d.garmentType === "socks" ? socksSizes : [] }),
        variant_shoes: variantBlockToDbJson({ ...vh, sizes: d.garmentType === "shoes" ? shoesSizes : [] })
      })
      .eq("id", created.id);
    if (updErr) {
      redirect(`/dashboard/products/new?error=${encodeURIComponent(formatPostgrestError(updErr))}`);
    }
  }

  redirect(`/dashboard/products/${created.id}/edit?ok=1`);
}

export default async function NewProductPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.products.read);
  if (!gate.ok) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from(PUBLIC_PRODUCT_CATEGORIES_TABLE)
    .select("id,name")
    .order("name");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Nieuw product</h1>
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-6">
        <NewProductPageClient action={createProduct} categories={categories ?? []} />
      </div>
    </div>
  );
}
