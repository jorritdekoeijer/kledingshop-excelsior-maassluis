import type { Permission } from "@/lib/auth/permissions";
import { permissions } from "@/lib/auth/permissions";

/** Rapportage: orders + voorraad + kostengroepen (interne afboekingen). */
export function hasFinancialReportAccess(
  perms: readonly Permission[],
  options: { isAdmin: boolean }
): boolean {
  if (options.isAdmin) return true;
  if (perms.includes(permissions.dashboard.access)) return true;
  return (
    perms.includes(permissions.orders.read) &&
    perms.includes(permissions.stock.read) &&
    perms.includes(permissions.costGroups.read)
  );
}
