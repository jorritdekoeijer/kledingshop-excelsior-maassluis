import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

async function grantAdmin(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  if (!admin.ok) redirect("/admin");

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) redirect("/admin/roles?error=Missing%20userId");

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
  if (error) redirect(`/admin/roles?error=${encodeURIComponent(error.message)}`);

  redirect("/admin/roles?ok=1");
}

async function revokeAdmin(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  if (!admin.ok) redirect("/admin");

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) redirect("/admin/roles?error=Missing%20userId");

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
  if (error) redirect(`/admin/roles?error=${encodeURIComponent(error.message)}`);

  redirect("/admin/roles?ok=1");
}

export default async function AdminRolesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  if (!admin.ok) redirect("/admin");

  const sp = (await searchParams) ?? {};
  const error = typeof sp.error === "string" ? sp.error : "";
  const ok = sp.ok ? true : false;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Rollen beheren</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Geef een user de admin-rol door hun Supabase Auth user UUID in te voeren.
      </p>

      {ok ? (
        <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Opgeslagen.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-6">
        <form action={grantAdmin} className="space-y-3 rounded-lg border border-zinc-200 p-4">
          <h2 className="text-sm font-medium">Admin toekennen</h2>
          <input
            name="userId"
            placeholder="User UUID"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white" type="submit">
            Grant admin
          </button>
        </form>

        <form action={revokeAdmin} className="space-y-3 rounded-lg border border-zinc-200 p-4">
          <h2 className="text-sm font-medium">Admin intrekken</h2>
          <input
            name="userId"
            placeholder="User UUID"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium" type="submit">
            Revoke admin
          </button>
        </form>
      </div>
    </div>
  );
}

