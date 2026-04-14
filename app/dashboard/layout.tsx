import Link from "next/link";
import type { ReactNode } from "react";
import { getIsAdmin, getUserPermissions, requireLogin } from "@/lib/auth/permissions-server";
import { hasFinancialReportAccess } from "@/lib/auth/reporting-access";
import { hasPermission, permissions } from "@/lib/auth/permissions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { id: userId } = await requireLogin();
  const perms = await getUserPermissions(userId);
  const isAdmin = await getIsAdmin();
  const hasDashboardAccess = hasPermission(perms, permissions.dashboard.access);

  const showSettings =
    isAdmin ||
    hasDashboardAccess ||
    hasPermission(perms, permissions.settings.read) ||
    perms.includes(permissions.suppliers.read) ||
    perms.includes(permissions.suppliers.write);
  const showProducts =
    isAdmin || hasDashboardAccess || hasPermission(perms, permissions.products.read);
  const showStock = isAdmin || hasDashboardAccess || hasPermission(perms, permissions.stock.read);
  const showOrders =
    isAdmin || hasDashboardAccess || hasPermission(perms, permissions.orders.read);
  const showReporting = hasFinancialReportAccess(perms, { isAdmin });

  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="font-semibold text-brand-blue">
            Beheer
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {isAdmin ? (
              <Link href="/admin" className="text-zinc-700 hover:text-brand-blue">
                Admin
              </Link>
            ) : null}
            {showSettings ? (
              <Link href="/dashboard/settings" className="text-zinc-700 hover:text-brand-blue">
                Instellingen
              </Link>
            ) : null}
            {showProducts ? (
              <Link href="/dashboard/products" className="text-zinc-700 hover:text-brand-blue">
                Producten
              </Link>
            ) : null}
            {showStock ? (
              <Link href="/dashboard/stock" className="text-zinc-700 hover:text-brand-blue">
                Voorraad
              </Link>
            ) : null}
            {showOrders ? (
              <Link href="/dashboard/orders" className="text-zinc-700 hover:text-brand-blue">
                Bestellingen
              </Link>
            ) : null}
            {showReporting ? (
              <Link href="/dashboard/rapportage" className="text-zinc-700 hover:text-brand-blue">
                Rapportage
              </Link>
            ) : null}
            <Link href="/" className="text-zinc-500 hover:text-brand-blue">
              Shop
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
