import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import Link from "next/link";

export default async function DashboardSettingsPage() {
  const gate = await requirePermission(permissions.settings.read);
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
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-zinc-600">Beheer gebruikers, e-mail, Mollie en kostengroepen.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/settings/users" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">Gebruikersbeheer</div>
          <div className="mt-1 text-sm text-zinc-600">Permissions per gebruiker.</div>
        </Link>
        <Link href="/dashboard/settings/email" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">E-mail (SMTP)</div>
          <div className="mt-1 text-sm text-zinc-600">Nodemailer SMTP configuratie via settings tabel.</div>
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
      </div>
    </div>
  );
}

