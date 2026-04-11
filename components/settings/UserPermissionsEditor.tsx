import { PERMISSION_OPTION_GROUPS } from "@/lib/auth/permission-options";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { updateUserPermissions } from "@/lib/settings/settings-server-actions";
import { SettingsBaseHidden } from "@/components/settings/SettingsBaseHidden";

type Props = {
  userId: string;
  email: string | null;
  currentPermissions: string[];
  base: SettingsSectionBase;
};

export function UserPermissionsEditor({ userId, email, currentPermissions, base }: Props) {
  const selected = new Set(currentPermissions);

  return (
    <form action={updateUserPermissions} className="space-y-5">
      <SettingsBaseHidden value={base} />
      <input type="hidden" name="id" value={userId} />

      <div className="space-y-6">
        {PERMISSION_OPTION_GROUPS.map((group) => (
          <fieldset key={group.title} className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
            <legend className="px-1 text-sm font-semibold text-zinc-900">{group.title}</legend>
            {group.description ? <p className="mt-2 text-xs text-zinc-600">{group.description}</p> : null}
            <ul className="mt-3 space-y-3">
              {group.options.map((opt) => {
                const id = `${userId}-${opt.key}`;
                return (
                  <li key={opt.key} className="flex gap-3">
                    <input
                      id={id}
                      type="checkbox"
                      name="permissions"
                      value={opt.key}
                      defaultChecked={selected.has(opt.key)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-blue focus:ring-brand-blue"
                    />
                    <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm leading-snug">
                      <span className="font-medium text-zinc-900">{opt.label}</span>
                      {opt.hint ? <span className="mt-0.5 block text-xs font-normal text-zinc-600">{opt.hint}</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
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
