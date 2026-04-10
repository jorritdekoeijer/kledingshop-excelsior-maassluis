import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";

const createSchema = z.object({ name: z.string().min(1).max(80) });
const renameSchema = z.object({ id: z.string().uuid(), name: z.string().min(1).max(80) });
const deleteSchema = z.object({ id: z.string().uuid() });

async function createCostGroup(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.costGroups.write);
  if (!gate.ok) redirect("/dashboard/settings/cost-groups?error=Geen%20toegang");

  const parsed = createSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect("/dashboard/settings/cost-groups?error=Invalid%20name");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cost_groups").insert({ name: parsed.data.name });
  if (error) redirect(`/dashboard/settings/cost-groups?error=${encodeURIComponent(error.message)}`);

  redirect("/dashboard/settings/cost-groups?ok=1");
}

async function renameCostGroup(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.costGroups.write);
  if (!gate.ok) redirect("/dashboard/settings/cost-groups?error=Geen%20toegang");

  const parsed = renameSchema.safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) redirect("/dashboard/settings/cost-groups?error=Invalid");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cost_groups").update({ name: parsed.data.name }).eq("id", parsed.data.id);
  if (error) redirect(`/dashboard/settings/cost-groups?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard/settings/cost-groups?ok=1");
}

async function deleteCostGroup(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.costGroups.write);
  if (!gate.ok) redirect("/dashboard/settings/cost-groups?error=Geen%20toegang");

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect("/dashboard/settings/cost-groups?error=Invalid");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cost_groups").delete().eq("id", parsed.data.id);
  if (error) redirect(`/dashboard/settings/cost-groups?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard/settings/cost-groups?ok=1");
}

export default async function CostGroupsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.costGroups.read);
  if (!gate.ok) redirect("/dashboard/settings");

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ? true : false;
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();
  const { data: groups } = await supabase.from("cost_groups").select("id,name,created_at").order("created_at");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Kostengroepen</h1>
      <p className="mt-2 text-sm text-zinc-600">Beheer kostengroepen.</p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form action={createCostGroup} className="mt-6 flex gap-2">
        <input
          name="name"
          placeholder="Nieuwe kostengroep"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
          Toevoegen
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {(groups ?? []).map((g) => (
          <li key={g.id} className="rounded-md border border-zinc-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{g.name}</span>
              <form action={deleteCostGroup}>
                <input type="hidden" name="id" value={g.id} />
                <button className="text-sm text-brand-red hover:underline" type="submit">
                  Verwijderen
                </button>
              </form>
            </div>
            <form action={renameCostGroup} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={g.id} />
              <input
                name="name"
                defaultValue={g.name}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium" type="submit">
                Opslaan
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

