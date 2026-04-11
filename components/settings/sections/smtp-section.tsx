import { getSetting } from "@/lib/settings";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { saveSmtpSettings } from "@/lib/settings/settings-server-actions";
import { SettingsBaseHidden } from "@/components/settings/SettingsBaseHidden";

export async function SmtpSettingsSection({
  base,
  ok,
  error
}: {
  base: SettingsSectionBase;
  ok: boolean;
  error: string;
}) {
  const existing = (await getSetting("smtp")) as Partial<Record<string, unknown>>;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">E-mail (SMTP)</h1>
      <p className="mt-2 text-sm text-zinc-600">Deze gegevens worden gebruikt door Nodemailer.</p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form action={saveSmtpSettings} className="mt-6 grid gap-3 md:grid-cols-2">
        <SettingsBaseHidden value={base} />
        <label className="block">
          <span className="text-sm text-zinc-700">Host</span>
          <input
            name="host"
            defaultValue={String(existing.host ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Port</span>
          <input
            name="port"
            defaultValue={String(existing.port ?? "587")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Secure (true/false)</span>
          <input
            name="secure"
            defaultValue={String(existing.secure ?? "false")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">User</span>
          <input
            name="user"
            defaultValue={String(existing.user ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Pass</span>
          <input
            name="pass"
            type="password"
            defaultValue={String(existing.pass ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">From (email)</span>
          <input
            name="from"
            defaultValue={String(existing.from ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="md:col-span-2">
          <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
            Opslaan
          </button>
        </div>
      </form>
    </div>
  );
}
