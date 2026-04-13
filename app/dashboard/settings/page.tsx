import Link from "next/link";
import { getIsAdmin, requireAdminOrPermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";

export default async function DashboardSettingsPage() {
  const gate = await requireAdminOrPermission(permissions.settings.read);
  const isAdmin = await getIsAdmin();

  if (!gate.ok) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Geen toegang</h1>
        <p className="mt-2 text-sm text-zinc-600">Je hebt geen permissie om settings te bekijken.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="rounded-lg border border-brand-blue/30 bg-brand-blue/5 p-4">
          <p className="text-sm text-zinc-800">
            Je bent ingelogd als <span className="font-medium">admin</span>. Alle instellingen vind je ook onder{" "}
            <Link href="/admin/settings" className="font-medium text-brand-blue underline">
              Admin → Instellingen
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-zinc-600">Beheer homepage, gebruikers, e-mail, Mollie en kostengroepen.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/settings/homepage" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">Homepage</div>
          <div className="mt-1 text-sm text-zinc-600">Banner, logo, hero, tegels naar categorieën.</div>
        </Link>
        <Link href="/dashboard/settings/users" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">Gebruikersbeheer</div>
          <div className="mt-1 text-sm text-zinc-600">Permissions per gebruiker.</div>
        </Link>
        <Link href="/dashboard/settings/email" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">E-mail (SMTP)</div>
          <div className="mt-1 text-sm text-zinc-600">Nodemailer SMTP configuratie via settings tabel.</div>
        </Link>
        <Link
          href="/dashboard/settings/monthly-email"
          className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        >
          <div className="font-medium">Maandelijkse e-mail</div>
          <div className="mt-1 text-sm text-zinc-600">Cron-samenvatting omzet en aantal orders.</div>
        </Link>
        <Link href="/dashboard/settings/mollie" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">Mollie</div>
          <div className="mt-1 text-sm text-zinc-600">API key + webhook secret.</div>
        </Link>
        <Link
          href="/dashboard/settings/cost-groups"
          className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        >
          <div className="font-medium">Kostengroepen</div>
          <div className="mt-1 text-sm text-zinc-600">CRUD kostengroepen.</div>
        </Link>
        <Link
          href="/dashboard/settings/suppliers"
          className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50"
        >
          <div className="font-medium">Leveranciers</div>
          <div className="mt-1 text-sm text-zinc-600">NAW + e-mail voor leveranciersbestellingen.</div>
        </Link>
      </div>
    </div>
  );
}
