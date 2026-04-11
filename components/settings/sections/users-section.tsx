import { UserPermissionsEditor } from "@/components/settings/UserPermissionsEditor";
import { ALL_KNOWN_PERMISSION_KEYS } from "@/lib/auth/permission-options";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function UsersSettingsSection({
  base,
  ok,
  error
}: {
  base: SettingsSectionBase;
  ok: boolean;
  error: string;
}) {
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
        Vink per persoon aan wat hij of zij in het commissie-dashboard mag doen. Admin-rechten voor{" "}
        <span className="font-medium">/admin</span> stel je apart in via Admin → Rollen.
      </p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {usersError ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{usersError.message}</p>
      ) : null}

      <div className="mt-6 space-y-8">
        {(users ?? []).map((u) => {
          const perms = (u.permissions ?? []) as string[];
          const known = new Set(ALL_KNOWN_PERMISSION_KEYS);
          const unknownExtra = perms.filter((p) => !known.has(p));

          return (
            <div key={u.id} className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
              <div className="border-b border-zinc-100 pb-3">
                <div className="text-base font-semibold text-zinc-900">{u.email ?? "Geen e-mail"}</div>
                <div className="mt-1 font-mono text-xs text-zinc-500">{u.id}</div>
              </div>

              {unknownExtra.length > 0 ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Extra rechten (buiten dit formulier) blijven behouden:{" "}
                  <span className="font-mono">{unknownExtra.join(", ")}</span>
                </p>
              ) : null}

              <div className="mt-4">
                <UserPermissionsEditor
                  userId={u.id}
                  email={u.email}
                  currentPermissions={perms}
                  base={base}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
