import { getSetting } from "@/lib/settings";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { saveMollieSettings } from "@/lib/settings/settings-server-actions";
import { SettingsBaseHidden } from "@/components/settings/SettingsBaseHidden";

export async function MollieSettingsSection({
  base,
  ok,
  error
}: {
  base: SettingsSectionBase;
  ok: boolean;
  error: string;
}) {
  const existing = (await getSetting("mollie")) as Partial<Record<string, unknown>>;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Mollie</h1>
      <p className="mt-2 text-sm text-zinc-600">API key en webhook secret voor verificatie.</p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form action={saveMollieSettings} className="mt-6 space-y-3">
        <SettingsBaseHidden value={base} />
        <label className="block">
          <span className="text-sm text-zinc-700">API key</span>
          <input
            name="apiKey"
            defaultValue={String(existing.apiKey ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm text-zinc-700">Webhook secret</span>
          <input
            name="webhookSecret"
            defaultValue={String(existing.webhookSecret ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
          Opslaan
        </button>
      </form>
    </div>
  );
}
