import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { PUBLIC_PRODUCT_CATEGORIES_TABLE } from "@/lib/db/public-tables";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { slugify } from "@/lib/utils/slugify";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().optional().default("")
});
const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80)
});
const deleteSchema = z.object({ id: z.string().uuid() });

async function createCategory(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect("/dashboard/products/categories?error=Geen%20toegang");

  const parsed = createSchema.safeParse({ name: formData.get("name"), slug: String(formData.get("slug") ?? "") });
  if (!parsed.success) redirect("/dashboard/products/categories?error=Invalid");

  const slug = slugify(parsed.data.slug ? parsed.data.slug : parsed.data.name);
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from(PUBLIC_PRODUCT_CATEGORIES_TABLE).insert({ name: parsed.data.name, slug });
  if (error) redirect(`/dashboard/products/categories?error=${encodeURIComponent(error.message)}`);

  redirect("/dashboard/products/categories?ok=1");
}

async function updateCategory(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect("/dashboard/products/categories?error=Geen%20toegang");

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") ?? ""))
  });
  if (!parsed.success) redirect("/dashboard/products/categories?error=Invalid");

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from(PUBLIC_PRODUCT_CATEGORIES_TABLE)
    .update({ name: parsed.data.name, slug: parsed.data.slug })
    .eq("id", parsed.data.id);
  if (error) redirect(`/dashboard/products/categories?error=${encodeURIComponent(error.message)}`);

  redirect("/dashboard/products/categories?ok=1");
}

async function deleteCategory(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect("/dashboard/products/categories?error=Geen%20toegang");

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/dashboard/products/categories?error=Invalid");

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from(PUBLIC_PRODUCT_CATEGORIES_TABLE).delete().eq("id", parsed.data.id);
  if (error) redirect(`/dashboard/products/categories?error=${encodeURIComponent(error.message)}`);

  redirect("/dashboard/products/categories?ok=1");
}

export default async function CategoriesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.products.read);
  if (!gate.ok) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ? true : false;
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from(PUBLIC_PRODUCT_CATEGORIES_TABLE)
    .select("id,name,slug,created_at")
    .order("created_at");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Categorieën</h1>
        <p className="mt-2 text-sm text-zinc-600">Beheer categorieën voor producten.</p>

        {ok ? (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <form action={createCategory} className="mt-6 grid gap-2 md:grid-cols-3">
          <input
            name="name"
            placeholder="Naam"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="slug"
            placeholder="Slug (optioneel)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
            Toevoegen
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="space-y-3">
          {(categories ?? []).map((c) => (
            <div key={c.id} className="rounded-md border border-zinc-200 p-4">
              <div className="grid gap-2 md:grid-cols-3">
                <form action={updateCategory} className="contents">
                  <input type="hidden" name="id" value={c.id} />
                  <input
                    name="name"
                    defaultValue={c.name}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <input
                    name="slug"
                    defaultValue={c.slug}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium" type="submit">
                      Opslaan
                    </button>
                  </div>
                </form>
                <form action={deleteCategory} className="md:col-span-3">
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-sm font-medium text-brand-red hover:underline" type="submit">
                    Verwijderen
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

