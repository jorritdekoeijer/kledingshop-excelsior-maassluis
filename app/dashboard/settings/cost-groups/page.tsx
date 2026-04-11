import { redirect } from "next/navigation";
import { requireAdminOrPermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { CostGroupsSettingsSection } from "@/components/settings/sections/cost-groups-section";

export default async function CostGroupsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requireAdminOrPermission(permissions.costGroups.read);
  if (!gate.ok) redirect("/dashboard/settings");

  const sp = (await searchParams) ?? {};
  const ok = Boolean(sp.ok);
  const error = typeof sp.error === "string" ? sp.error : "";

  return <CostGroupsSettingsSection base="/dashboard/settings" ok={ok} error={error} />;
}
