import { redirect } from "next/navigation";
import {
  HomepageSettingsSection,
  loadCategoriesForHomepageSettings
} from "@/components/settings/sections/homepage-section";
import { loadHomepageSettings } from "@/lib/homepage/load-public";
import { requireAdminOrPermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";

export default async function DashboardHomepageSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requireAdminOrPermission(permissions.settings.read);
  if (!gate.ok) redirect("/dashboard/settings");

  const sp = (await searchParams) ?? {};
  const ok = Boolean(sp.ok);
  const error = typeof sp.error === "string" ? sp.error : "";

  const [config, categories] = await Promise.all([loadHomepageSettings(), loadCategoriesForHomepageSettings()]);

  return (
    <HomepageSettingsSection
      base="/dashboard/settings"
      config={config}
      ok={ok}
      error={error}
      categories={categories}
    />
  );
}
