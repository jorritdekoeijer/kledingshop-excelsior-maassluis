import {
  accessLevelForPair,
  DASHBOARD_ACCESS_KEY,
  PERMISSION_LEVEL_PAIRS,
  type AccessLevel
} from "@/lib/auth/permission-options";
import { SettingsBaseHidden } from "@/components/settings/SettingsBaseHidden";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { updateUserPermissions } from "@/lib/settings/settings-server-actions";

type Props = {
  userId: string;
  email: string | null;
  currentPermissions: string[];
  base: SettingsSectionBase;
};

function LevelRadios({
  name,
  userId,
  level,
  disabled = false
}: {
  name: string;
  userId: string;
  level: AccessLevel;
  disabled?: boolean;
}) {
  const opts: { value: AccessLevel; label: string; hint?: string }[] = [
    { value: "none", label: "Geen toegang", hint: "Dit onderdeel niet tonen in het menu." },
    { value: "read", label: "Alleen bekijken", hint: "Inzien, niet wijzigen." },
    { value: "write", label: "Bekijken en wijzigen", hint: "Alles doen binnen dit onderdeel." }
  ];

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {opts.map((o) => {
        const id = `${userId}-${name}-${o.value}`;
        return (
          <label
            key={o.value}
            htmlFor={id}
            className={`flex rounded-lg border px-3 py-2.5 text-sm transition ${
              level === o.value
                ? "border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue/30"
                : "border-zinc-200 bg-white"
            } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-zinc-300"}`}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={level === o.value}
              disabled={disabled}
              className="mt-0.5 h-4 w-4 shrink-0 border-zinc-300 text-brand-blue focus:ring-brand-blue"
            />
            <span className="ml-2 min-w-0">
              <span className="font-medium text-zinc-900">{o.label}</span>
              {o.hint ? <span className="mt-0.5 block text-xs font-normal text-zinc-600">{o.hint}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function UserPermissionsEditor({ userId, email, currentPermissions, base }: Props) {
  const selected = new Set(currentPermissions);
  const hasFullDashboard = selected.has(DASHBOARD_ACCESS_KEY);

  return (
    <form action={updateUserPermissions} className="space-y-5">
      <SettingsBaseHidden value={base} />
      <input type="hidden" name="id" value={userId} />

      <fieldset className="rounded-lg border border-brand-blue/30 bg-brand-blue/[0.06] p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-900">Snelkoppeling</legend>
        <p className="mt-1 text-xs text-zinc-600">
          Als je dit aanzet, telt dat als toegang tot alle onderdelen hieronder. Zet het uit om per onderdeel te kiezen.
        </p>
        <label className="mt-3 flex cursor-pointer gap-3 rounded-lg border border-zinc-200 bg-white p-3">
          <input
            type="checkbox"
            name="full_dashboard"
            value="1"
            defaultChecked={hasFullDashboard}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-brand-blue focus:ring-brand-blue"
          />
          <span>
            <span className="font-medium text-zinc-900">Volledige toegang tot het hele beheer</span>
            <span className="mt-0.5 block text-xs text-zinc-600">
              Zelfde als overal &quot;Bekijken en wijzigen&quot; — handig voor hoofdbeheerders.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="space-y-6">
        <p className="text-sm font-medium text-zinc-800">Per onderdeel</p>
        {hasFullDashboard ? (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            Omdat <strong>Volledige toegang</strong> aan staat, zijn de keuzes per onderdeel hieronder ter informatie en
            niet aanpasbaar.
          </p>
        ) : null}
        {PERMISSION_LEVEL_PAIRS.map((pair) => {
          const level = hasFullDashboard ? "write" : accessLevelForPair(selected, pair.readKey, pair.writeKey);
          return (
            <fieldset key={pair.formField} className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
              <legend className="px-1 text-sm font-semibold text-zinc-900">{pair.title}</legend>
              {pair.description ? <p className="mt-1 text-xs text-zinc-600">{pair.description}</p> : null}
              <LevelRadios name={pair.formField} userId={userId} level={level} disabled={hasFullDashboard} />
            </fieldset>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4">
        <button
          type="submit"
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          Opslaan voor {email ?? "deze gebruiker"}
        </button>
      </div>
    </form>
  );
}
