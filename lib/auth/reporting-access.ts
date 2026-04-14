import type { Permission } from "@/lib/auth/permissions";
import { permissions } from "@/lib/auth/permissions";

/** Rapportage: expliciet `reporting:*`, of legacy-combo orders+voorraad+kostengroepen. */
export function hasFinancialReportAccess(
  perms: readonly Permission[],
  options: { isAdmin: boolean }
): boolean {
  if (options.isAdmin) return true;
  if (perms.includes(permissions.dashboard.access)) return true;
  if (perms.includes(permissions.reporting.read) || perms.includes(permissions.reporting.write)) return true;
  return (
    perms.includes(permissions.orders.read) &&
    perms.includes(permissions.stock.read) &&
    perms.includes(permissions.costGroups.read)
  );
}
