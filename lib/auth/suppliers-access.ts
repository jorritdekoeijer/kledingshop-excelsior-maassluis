import type { Permission } from "@/lib/auth/permissions";
import { permissions } from "@/lib/auth/permissions";

/** Leverancierspagina: eigen rechten, of legacy via algemene instellingen. */
export function hasSuppliersSettingsAccess(
  perms: readonly Permission[],
  options: { isAdmin: boolean }
): boolean {
  if (options.isAdmin) return true;
  if (perms.includes(permissions.dashboard.access)) return true;
  if (perms.includes(permissions.suppliers.read) || perms.includes(permissions.suppliers.write)) return true;
  return perms.includes(permissions.settings.read) || perms.includes(permissions.settings.write);
}
