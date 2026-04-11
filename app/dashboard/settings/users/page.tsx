import { redirect } from "next/navigation";
import { requireAdminOrPermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { UsersSettingsSection } from "@/components/settings/sections/users-section";

export default async function UsersSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requireAdminOrPermission(permissions.users.read);
  if (!gate.ok) redirect("/dashboard/settings");

  const sp = (await searchParams) ?? {};
  const ok = Boolean(sp.ok);
  const error = typeof sp.error === "string" ? sp.error : "";

  return <UsersSettingsSection base="/dashboard/settings" ok={ok} error={error} />;
}
