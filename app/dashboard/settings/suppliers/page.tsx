import { redirect } from "next/navigation";
import {
  getIsAdmin,
  getUserPermissions,
  requireLogin,
} from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { SuppliersSettingsSection } from "@/components/settings/sections/suppliers-section";

export default async function SuppliersSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireLogin();
  const isAdmin = await getIsAdmin();
  const perms = await getUserPermissions(user.id);
  const canView =
    isAdmin ||
    perms.includes(permissions.dashboard.access) ||
    perms.includes(permissions.suppliers.read) ||
    perms.includes(permissions.suppliers.write) ||
    perms.includes(permissions.settings.read) ||
    perms.includes(permissions.settings.write);
  if (!canView) redirect("/dashboard/settings");

  const canMutate =
    isAdmin ||
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

