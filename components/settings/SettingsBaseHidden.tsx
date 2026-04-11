import type { SettingsSectionBase } from "@/lib/settings/settings-base";

export function SettingsBaseHidden({ value }: { value: SettingsSectionBase }) {
  return <input type="hidden" name="settingsBase" value={value} />;
}
