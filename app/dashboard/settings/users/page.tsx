import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";

const updateSchema = z.object({
  id: z.string().uuid(),
  permissions: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    )
});

async function updateUserPermissions(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.users.write);
  if (!gate.ok) redirect("/dashboard/settings/users?error=Geen%20toegang");

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    permissions: String(formData.get("permissions") ?? "")
  });
  if (!parsed.success) redirect("/dashboard/settings/users?error=Invalid");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("user_profiles").update({ permissions: parsed.data.permissions }).eq("id", parsed.data.id);
  if (error) redirect(`/dashboard/settings/users?error=${encodeURIComponent(error.message)}`);

  redirect("/dashboard/settings/users?ok=1");
}

export default async function UsersSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.users.read);
  if (!gate.ok) redirect("/dashboard/settings");

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ? true : false;
  const error = typeof sp.error === "string" ? sp.error : "";

  const supabase = await createSupabaseServerClient();
  const { data: users, error: usersError } = await supabase
    .from("user_profiles")
    .select("id,email,permissions,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Gebruikersbeheer</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Bewerk permissions in <span className="font-medium">comma-separated</span> vorm (bijv.{" "}
        <span className="font-mono text-xs">dashboard:access, settings:read</span>).
      </p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {usersError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {usersError.message}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {(users ?? []).map((u) => (
          <div key={u.id} className="rounded-md border border-zinc-200 p-4">
            <div className="text-sm font-medium">{u.email ?? u.id}</div>
            <div className="mt-1 text-xs text-zinc-600">{u.id}</div>

            <form action={updateUserPermissions} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={u.id} />
              <input
                name="permissions"
                defaultValue={(u.permissions ?? []).join(", ")}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium" type="submit">
                Opslaan
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

