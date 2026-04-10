import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { productUpsertSchema } from "@/lib/validation/products";
import { slugify } from "@/lib/utils/slugify";

async function createProduct(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect("/dashboard/products?error=Geen%20toegang");

  const parsed = productUpsertSchema.safeParse({
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") ?? "")) || slugify(String(formData.get("name") ?? "")),
    description: String(formData.get("description") ?? "") || null,
    priceCents: formData.get("priceCents"),
    active: formData.get("active"),
    categoryId: String(formData.get("categoryId") ?? "") || null,
    costGroupId: String(formData.get("costGroupId") ?? "") || null
  });
  if (!parsed.success) redirect(`/dashboard/products/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid")}`);

  const service = createSupabaseServiceClient();
  const { data: created, error } = await service
    .from("products")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      price_cents: parsed.data.priceCents,
      active: parsed.data.active,
      category_id: parsed.data.categoryId,
      cost_group_id: parsed.data.costGroupId
    })
    .select("id")
    .single();

  if (error || !created) redirect(`/dashboard/products/new?error=${encodeURIComponent(error?.message ?? "Create failed")}`);

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `products/${created.id}.${ext}`;
    const upload = await service.storage.from("product-images").upload(path, file, { upsert: true, contentType: file.type });
    if (upload.error) redirect(`/dashboard/products/${created.id}/edit?error=${encodeURIComponent(upload.error.message)}`);
    await service.from("product_images").insert({ product_id: created.id, path, sort_order: 0, is_primary: true });
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
  const { data: categories } = await supabase.from("categories").select("id,name").order("name");
  const { data: costGroups } = await supabase.from("cost_groups").select("id,name").order("name");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Nieuw product</h1>
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form action={createProduct} className="mt-6 grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Naam</span>
          <input name="name" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Slug (optioneel)</span>
          <input name="slug" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Prijs (centen)</span>
          <input
            name="priceCents"
            defaultValue="0"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Actief (true/false)</span>
          <input
            name="active"
            defaultValue="true"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Categorie</span>
          <select name="categoryId" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
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
          <select name="costGroupId" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
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
            className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Productfoto</span>
          <input name="image" type="file" accept="image/*" className="mt-1 w-full text-sm" />
        </label>

        <div className="md:col-span-2">
          <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
            Aanmaken
          </button>
        </div>
      </form>
    </div>
  );
}

