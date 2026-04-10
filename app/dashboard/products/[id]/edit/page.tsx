import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { productUpsertSchema } from "@/lib/validation/products";
import { slugify } from "@/lib/utils/slugify";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";

const paramsSchema = z.object({ id: z.string().uuid() });

async function updateProduct(productId: string, formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const parsed = productUpsertSchema.safeParse({
    id: productId,
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") ?? "")) || slugify(String(formData.get("name") ?? "")),
    description: String(formData.get("description") ?? "") || null,
    priceCents: formData.get("priceCents"),
    active: formData.get("active"),
    categoryId: String(formData.get("categoryId") ?? "") || null,
    costGroupId: String(formData.get("costGroupId") ?? "") || null
  });
  if (!parsed.success) redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid")}`);

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("products")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      price_cents: parsed.data.priceCents,
      active: parsed.data.active,
      category_id: parsed.data.categoryId,
      cost_group_id: parsed.data.costGroupId
    })
    .eq("id", productId);
  if (error) redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(error.message)}`);

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
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

    await service
      .from("product_images")
      .insert({ product_id: productId, path, sort_order: 0, is_primary: existingPrimary ? false : true });
  }

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
  if (error) redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(error.message)}`);

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
  const { error } = await service.from("product_images").delete().eq("id", imageId).eq("product_id", productId);
  if (error) redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(error.message)}`);

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
    .select("id,name,slug,description,price_cents,active,category_id,cost_group_id")
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

  const { data: categories } = await supabase.from("categories").select("id,name").order("name");
  const { data: costGroups } = await supabase.from("cost_groups").select("id,name").order("name");

  const primaryImg = (images ?? []).find((i) => i.is_primary) ?? null;
  const img = getPublicProductImageUrl(primaryImg?.path);

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

      <form action={updateProduct.bind(null, id)} className="mt-6 grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Naam</span>
          <input
            name="name"
            defaultValue={product.name}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Slug</span>
          <input
            name="slug"
            defaultValue={product.slug}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Prijs (centen)</span>
          <input
            name="priceCents"
            defaultValue={String(product.price_cents)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Actief (true/false)</span>
          <input
            name="active"
            defaultValue={String(product.active)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Categorie</span>
          <select
            name="categoryId"
            defaultValue={product.category_id ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">(geen)</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Kostengroep</span>
          <select
            name="costGroupId"
            defaultValue={product.cost_group_id ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">(geen)</option>
            {(costGroups ?? []).map((cg) => (
              <option key={cg.id} value={cg.id}>
                {cg.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Omschrijving</span>
          <textarea
            name="description"
            defaultValue={product.description ?? ""}
            className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={img} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <label className="block w-full">
              <span className="text-sm text-zinc-700">Nieuwe foto uploaden</span>
              <input name="image" type="file" accept="image/*" className="mt-1 w-full text-sm" />
            </label>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="text-sm font-medium">Afbeeldingen</div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
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
                      <span className="text-xs font-medium text-brand-blue">Primary</span>
                    ) : (
                      <form action={setPrimaryImage.bind(null, id)}>
                        <input type="hidden" name="imageId" value={im.id} />
                        <button className="text-xs text-brand-blue hover:underline" type="submit">
                          Maak primary
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

        <div className="md:col-span-2">
          <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
            Opslaan
          </button>
        </div>
      </form>
    </div>
  );
}

