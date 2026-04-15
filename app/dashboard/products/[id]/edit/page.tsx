import { redirect } from "next/navigation";
import { z } from "zod";
import { ProductEditorForm } from "@/components/dashboard/ProductEditorForm";
import { productParsedToDbRow } from "@/lib/dashboard/product-db-row";
import { deleteReorderRulesNotInGarmentTemplates } from "@/lib/dashboard/reorder-rules-garment-cleanup";
import { parseProductUpsertFormData } from "@/lib/dashboard/product-form-parse";
import { resolveProductCategoryId } from "@/lib/dashboard/resolve-product-category-id";
import { normalizeProductDetails, normalizeVariantBlock } from "@/lib/shop/product-json";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { PUBLIC_PRODUCT_CATEGORIES_TABLE } from "@/lib/db/public-tables";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";
import { ProductEditPageClient } from "@/components/dashboard/ProductEditPageClient";
import { updateReorderRules } from "@/app/dashboard/products/[id]/reorder-rules/actions";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().uuid() });

async function updateProduct(productId: string, formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const parsed = parseProductUpsertFormData(formData);
  if (!parsed.ok) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(parsed.message)}`);
  }

  const d = parsed.value;
  const service = createSupabaseServiceClient();

  const { count: imageCount, error: imgCountErr } = await service
    .from("product_images")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if (imgCountErr) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(imgCountErr))}`);
  }
  if (!imageCount || imageCount < 1) {
    redirect(
      `/dashboard/products/${productId}/edit?error=${encodeURIComponent("Er moet minstens één productfoto zijn. Upload eerst een hoofdfoto bij Afbeeldingen.")}`
    );
  }

  const cat = await resolveProductCategoryId(service, d.categoryId);
  if (!cat.ok) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(cat.message)}`);
  }

  const { error } = await service
    .from("products")
    .update({
      ...productParsedToDbRow(d),
      category_id: cat.category_id
    })
    .eq("id", productId);
  if (error) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(error))}`);
  }

  await deleteReorderRulesNotInGarmentTemplates(service, productId, d.garmentType);

  redirect(`/dashboard/products/${productId}/edit?ok=1`);
}

async function uploadAdditionalImage(productId: string, formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent("Kies een afbeelding.")}`);
  }

  const service = createSupabaseServiceClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
  const upload = await service.storage.from("product-images").upload(path, file, { upsert: true, contentType: file.type });
  if (upload.error) redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(upload.error.message)}`);

  const { data: existingPrimary } = await service
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .eq("is_primary", true)
    .maybeSingle();

  await service.from("product_images").insert({
    product_id: productId,
    path,
    sort_order: 0,
    is_primary: existingPrimary ? false : true
  });

  redirect(`/dashboard/products/${productId}/edit?ok=1`);
}

async function setPrimaryImage(productId: string, formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const imageId = String(formData.get("imageId") ?? "");
  if (!imageId) redirect(`/dashboard/products/${productId}/edit?error=Missing%20imageId`);

  const service = createSupabaseServiceClient();
  await service.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  const { error } = await service.from("product_images").update({ is_primary: true }).eq("id", imageId).eq("product_id", productId);
  if (error) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(error))}`);
  }

  redirect(`/dashboard/products/${productId}/edit?ok=1`);
}

async function deleteImage(productId: string, formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const imageId = String(formData.get("imageId") ?? "");
  const path = String(formData.get("path") ?? "");
  if (!imageId || !path) redirect(`/dashboard/products/${productId}/edit?error=Missing%20image`);

  const service = createSupabaseServiceClient();
  const { count: beforeCount } = await service
    .from("product_images")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if (!beforeCount || beforeCount <= 1) {
    redirect(
      `/dashboard/products/${productId}/edit?error=${encodeURIComponent("Je kunt de enige productfoto niet verwijderen. Upload eerst een andere foto.")}`
    );
  }

  const { error } = await service.from("product_images").delete().eq("id", imageId).eq("product_id", productId);
  if (error) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(error))}`);
  }

  await service.storage.from("product-images").remove([path]);

  redirect(`/dashboard/products/${productId}/edit?ok=1`);
}

export default async function EditProductPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.products.read);
  if (!gate.ok) redirect("/dashboard");

  const { id } = paramsSchema.parse(await params);

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ? true : false;
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      "id,name,slug,description,price_cents,printing_excl_cents,temporary_discount_percent,active,category_id,garment_type,product_details,variant_youth,variant_adult,variant_socks"
    )
    .eq("id", id)
    .single();
  if (productError || !product) redirect("/dashboard/products?error=Not%20found");

  const { data: images } = await supabase
    .from("product_images")
    .select("id,path,is_primary,sort_order,created_at")
    .eq("product_id", id)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: categories } = await supabase
    .from(PUBLIC_PRODUCT_CATEGORIES_TABLE)
    .select("id,name")
    .order("name");

  const { data: reorderRules } = await supabase
    .from("stock_reorder_rules")
    .select("variant_segment,size_label,is_active,threshold_qty,target_qty")
    .eq("product_id", id);

  const primaryImg = (images ?? []).find((i) => i.is_primary) ?? null;
  const img = getPublicProductImageUrl(primaryImg?.path);

  const defaults = {
    name: product.name,
    slug: product.slug,
    description: product.description,
    temporaryDiscountPercent: Number(product.temporary_discount_percent ?? 0),
    printingExclCents: Number(product.printing_excl_cents ?? 0),
    active: product.active,
    categoryId: product.category_id,
    garmentType: (product.garment_type === "socks" ? "socks" : "clothing") as "clothing" | "socks",
    productDetails: normalizeProductDetails(product.product_details),
    variantYouth: normalizeVariantBlock(product.variant_youth),
    variantAdult: normalizeVariantBlock(product.variant_adult),
    variantSocks: normalizeVariantBlock((product as any).variant_socks)
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Product bewerken</h1>
      <p className="mt-2 text-sm text-zinc-600">{product.name}</p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {(images ?? []).length === 0 ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Upload minstens één productfoto hieronder. Zonder foto kun je de productgegevens niet opslaan.
        </p>
      ) : null}

      <div className="mt-6">
        <ProductEditPageClient
          productId={id}
          categories={(categories ?? []) as any}
          defaults={defaults as any}
          reorderRules={(((reorderRules ?? []) as any) ?? []) as any}
          updateProductAction={updateProduct.bind(null, id)}
          updateReorderRulesAction={updateReorderRules.bind(null, id)}
        />
      </div>

      <div className="mt-10 border-t border-zinc-200 pt-8">
        <h2 className="text-lg font-medium text-zinc-900">Afbeeldingen</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Upload extra foto&apos;s. De eerste (of degene die je als hoofdfoto zet) wordt in overzichten getoond.
        </p>

        <form action={uploadAdditionalImage.bind(null, id)} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-sm text-zinc-700">Nieuwe foto</span>
            <input name="image" type="file" accept="image/*" className="mt-1 block w-full max-w-sm text-sm" />
          </label>
          <button className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-white" type="submit">
            Uploaden
          </button>
        </form>

        <div className="mt-6 flex items-start gap-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={img} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">—</div>
            )}
          </div>
          <p className="text-xs text-zinc-500">Huidige hoofdfoto in overzichten (primary).</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {(images ?? []).map((im) => {
            const url = getPublicProductImageUrl(im.path);
            return (
              <div key={im.id} className="rounded-md border border-zinc-200 p-2">
                <div className="aspect-square overflow-hidden rounded-md bg-zinc-50">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={url} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {im.is_primary ? (
                    <span className="text-xs font-medium text-brand-blue">Hoofdfoto</span>
                  ) : (
                    <form action={setPrimaryImage.bind(null, id)}>
                      <input type="hidden" name="imageId" value={im.id} />
                      <button className="text-xs text-brand-blue hover:underline" type="submit">
                        Maak hoofdfoto
                      </button>
                    </form>
                  )}
                  <form action={deleteImage.bind(null, id)}>
                    <input type="hidden" name="imageId" value={im.id} />
                    <input type="hidden" name="path" value={im.path} />
                    <button className="text-xs text-brand-red hover:underline" type="submit">
                      Verwijder
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
