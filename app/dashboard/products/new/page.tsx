import { redirect } from "next/navigation";
import { ProductEditorForm } from "@/components/dashboard/ProductEditorForm";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { parseProductUpsertFormData } from "@/lib/dashboard/product-form-parse";
import { resolveProductCategoryId } from "@/lib/dashboard/resolve-product-category-id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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
    .insert({
      name: d.name,
      slug: d.slug,
      description: d.description,
      price_cents: d.priceCents,
      temporary_discount_percent: d.temporaryDiscountPercent,
      active: d.active,
      category_id: cat.category_id,
      product_details: d.productDetails,
      variant_youth: d.variantYouth,
      variant_adult: d.variantAdult
    })
    .select("id")
    .single();

  if (error || !created) redirect(`/dashboard/products/new?error=${encodeURIComponent(error?.message ?? "Create failed")}`);

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `products/${created.id}.${ext}`;
  const upload = await service.storage.from("product-images").upload(path, file, { upsert: true, contentType: file.type });
  if (upload.error) redirect(`/dashboard/products/${created.id}/edit?error=${encodeURIComponent(upload.error.message)}`);
  await service.from("product_images").insert({ product_id: created.id, path, sort_order: 0, is_primary: true });

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
  const { data: categories } = await supabase.from("categories").select("id,name").order("name");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Nieuw product</h1>
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-6">
        <ProductEditorForm action={createProduct} categories={categories ?? []} showImageUpload />
      </div>
    </div>
  );
}
