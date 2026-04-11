import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { createCostGroup, deleteCostGroup, renameCostGroup } from "@/lib/settings/settings-server-actions";
import { SettingsBaseHidden } from "@/components/settings/SettingsBaseHidden";

export async function CostGroupsSettingsSection({
  base,
  ok,
  error
}: {
  base: SettingsSectionBase;
  ok: boolean;
  error: string;
}) {
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
        <SettingsBaseHidden value={base} />
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
                <SettingsBaseHidden value={base} />
                <input type="hidden" name="id" value={g.id} />
                <button className="text-sm text-brand-red hover:underline" type="submit">
                  Verwijderen
                </button>
              </form>
            </div>
            <form action={renameCostGroup} className="mt-3 flex gap-2">
              <SettingsBaseHidden value={base} />
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
