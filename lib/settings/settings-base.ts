/** Hidden form field `settingsBase`: admin- vs dashboard-instellingenroutes. */
export type SettingsSectionBase = "/admin/settings" | "/dashboard/settings";

export function settingsSectionBase(formData: FormData): SettingsSectionBase {
  return formData.get("settingsBase") === "/admin/settings" ? "/admin/settings" : "/dashboard/settings";
}
