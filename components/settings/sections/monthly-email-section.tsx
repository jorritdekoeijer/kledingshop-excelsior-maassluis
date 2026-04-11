import { getSetting } from "@/lib/settings";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { saveMonthlyEmailSettings } from "@/lib/settings/settings-server-actions";
import { SettingsBaseHidden } from "@/components/settings/SettingsBaseHidden";

export async function MonthlyEmailSettingsSection({
  base,
  ok,
  error
}: {
  base: SettingsSectionBase;
  ok: boolean;
  error: string;
}) {
  const raw = (await getSetting("monthly_email")) as Partial<Record<string, unknown>>;
  const day = typeof raw.dayOfMonth === "number" ? raw.dayOfMonth : 5;
  const enabled = raw.enabled !== false;
  const recipient = typeof raw.recipientEmail === "string" ? raw.recipientEmail : "";
  const lastSent = typeof raw.lastCompletedReportPeriod === "string" ? raw.lastCompletedReportPeriod : "";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Maandelijkse e-mail</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Op de gekozen dag (Europe/Amsterdam) stuurt de cron een korte samenvatting: aantal betaalde/afgehandelde orders en omzet over{" "}
        <span className="font-medium">de vorige kalendermaand</span>. Plan een cronjob (bijv. dagelijks) op{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs">GET /api/cron/monthly-email</code> met header{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs">x-cron-secret</code>. Alternatief ontvanger: omgevingsvariabele{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs">MONTHLY_DIGEST_EMAIL</code>.
      </p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {lastSent ? (
        <p className="mt-4 text-sm text-zinc-600">
          Laatst verstuurd rapport voor periode: <span className="font-mono">{lastSent}</span>
        </p>
      ) : null}

      <form action={saveMonthlyEmailSettings} className="mt-6 space-y-4">
        <SettingsBaseHidden value={base} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="rounded border-zinc-300" />
          Maandelijkse samenvatting inschakelen
        </label>

        <label className="block">
          <span className="text-sm text-zinc-700">Dag van de maand (1–28, Amsterdam-tijd)</span>
          <input
            name="dayOfMonth"
            type="number"
            min={1}
            max={28}
            required
            defaultValue={day}
            className="mt-1 w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm text-zinc-700">Ontvanger (e-mail commissie)</span>
          <input
            name="recipientEmail"
            type="email"
            defaultValue={recipient}
            placeholder="voorbeeld@club.nl"
            className="mt-1 w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          Opslaan
        </button>
      </form>
    </div>
  );
}
