import { redirect } from "next/navigation";
import {
  HomepageSettingsSection,
  loadCategoriesForHomepageSettings
} from "@/components/settings/sections/homepage-section";
import { loadHomepageSettings } from "@/lib/homepage/load-public";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminHomepageSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  if (!admin.ok) redirect("/admin");

  const sp = (await searchParams) ?? {};
  const ok = Boolean(sp.ok);
  const error = typeof sp.error === "string" ? sp.error : "";

  const [config, categories] = await Promise.all([loadHomepageSettings(), loadCategoriesForHomepageSettings()]);

  return (
    <HomepageSettingsSection
      base="/admin/settings"
      config={config}
      ok={ok}
      error={error}
      categories={categories}
    />
  );
}
