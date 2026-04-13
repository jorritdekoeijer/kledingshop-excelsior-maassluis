import Link from "next/link";
import { getIsAdmin, getUserPermissions, requireLogin } from "@/lib/auth/permissions-server";
import { hasFinancialReportAccess } from "@/lib/auth/reporting-access";
import { hasPermission, permissions } from "@/lib/auth/permissions";

type NavCard = {
  href: string;
  title: string;
  description: string;
  /** Permissie-string uit `permissions`, of `__reporting__` voor gecombineerde financiële rapportage. */
  needs: string | null;
};

const CARDS: NavCard[] = [
  {
    href: "/admin",
    title: "Admin",
    description: "Rollen en technisch beheer (aparte admin-omgeving).",
    needs: null
  },
  {
    href: "/dashboard/settings",
    title: "Instellingen",
    description: "E-mail, Mollie, gebruikersrechten en kostengroepen.",
    needs: permissions.settings.read
  },
  {
    href: "/dashboard/settings/homepage",
    title: "Homepage",
    description: "Banner, logo, hero en tegels naar categorieën.",
    needs: permissions.settings.read
  },
  {
    href: "/dashboard/products",
    title: "Producten",
    description: "Assortiment, categorieën en afbeeldingen.",
    needs: permissions.products.read
  },
  {
    href: "/dashboard/stock",
    title: "Voorraad",
    description: "Batches en FIFO-mutaties.",
    needs: permissions.stock.read
  },
  {
    href: "/dashboard/orders",
    title: "Bestellingen",
    description: "Orders bekijken en afhandelen.",
    needs: permissions.orders.read
  },
  {
    href: "/dashboard/rapportage",
    title: "Rapportage",
    description: "Omzet, marge, kostengroepen en voorraadwaarde.",
    needs: "__reporting__"
  }
];

export default async function DashboardHome() {
  const user = await requireLogin();
  const perms = await getUserPermissions(user.id);
  const isAdmin = await getIsAdmin();
  const hasDashboardAccess = hasPermission(perms, permissions.dashboard.access);

  const visible = CARDS.filter((c) => {
    if (c.href === "/admin") return isAdmin;
    if (!c.needs) return false;
    if (c.needs === "__reporting__") {
      return hasFinancialReportAccess(perms, { isAdmin });
    }
    return isAdmin || hasDashboardAccess || hasPermission(perms, c.needs);
  });

  const hasAnything = visible.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-blue">Beheer</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Kies een onderdeel. Je ziet alleen schermen waarvoor je rechten hebt.
        </p>
      </div>

      {!hasAnything ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">Nog geen rechten voor het beheer</p>
          <p className="mt-2 text-amber-800/90">
            Vraag een beheerder om permissies op je account te zetten (bijv. via{" "}
            <span className="font-mono text-xs">dashboard:access</span> of specifieke rechten zoals{" "}
            <span className="font-mono text-xs">products:read</span>), of controleer of je admin-rol actief is.
          </p>
          <p className="mt-3">
            <Link href="/" className="font-medium text-brand-blue underline">
              Terug naar de shop
            </Link>
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visible.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="block rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-brand-blue/40 hover:shadow-md"
              >
                <span className="font-semibold text-brand-blue">{c.title}</span>
                <p className="mt-2 text-sm text-zinc-600">{c.description}</p>
                <span className="mt-3 inline-block text-sm font-medium text-brand-red">Openen →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-zinc-500">
        <Link href="/" className="text-brand-blue hover:underline">
          Naar de homepage / shop
        </Link>
        {" · "}
        <Link href="/logout" className="hover:underline">
          Uitloggen
        </Link>
      </p>
    </div>
  );
}
