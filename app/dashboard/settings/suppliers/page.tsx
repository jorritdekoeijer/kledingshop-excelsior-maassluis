import { redirect } from "next/navigation";
import {
  getUserPermissions,
  requireLogin,
  requireOneOfPermissions
} from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { SuppliersSettingsSection } from "@/components/settings/sections/suppliers-section";

export default async function SuppliersSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireLogin();
  const gate = await requireOneOfPermissions([
    permissions.suppliers.read,
    permissions.suppliers.write,
    permissions.settings.read
  ]);
  if (!gate.ok) redirect("/dashboard/settings");

  const perms = await getUserPermissions(user.id);
  const canMutate =
    gate.isAdmin ||
    perms.includes(permissions.dashboard.access) ||
    perms.includes(permissions.suppliers.write) ||
    perms.includes(permissions.settings.write);

  const sp = (await searchParams) ?? {};
  const ok = Boolean(sp.ok);
  const error = typeof sp.error === "string" ? sp.error : "";

  return (
    <SuppliersSettingsSection base="/dashboard/settings" ok={ok} error={error} canMutate={canMutate} />
  );
}

