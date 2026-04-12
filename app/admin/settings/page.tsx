import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminSettingsHubPage() {
  const admin = await requireAdmin();
  if (!admin.ok) redirect("/admin");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Instellingen</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Homepage, SMTP, Mollie, maandelijkse e-mail, kostengroepen en gebruikersrechten — hetzelfde als onder Beheer,
          maar hier voor admins.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/settings/homepage" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">Homepage</div>
          <div className="mt-1 text-sm text-zinc-600">Banner, logo, hero, tegels naar categorieën.</div>
        </Link>
        <Link href="/admin/settings/users" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">Gebruikersbeheer</div>
          <div className="mt-1 text-sm text-zinc-600">Permissions per gebruiker.</div>
        </Link>
        <Link href="/admin/settings/email" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">E-mail (SMTP)</div>
          <div className="mt-1 text-sm text-zinc-600">Nodemailer SMTP-configuratie.</div>
        </Link>
        <Link href="/admin/settings/monthly-email" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">Maandelijkse e-mail</div>
          <div className="mt-1 text-sm text-zinc-600">Cron-samenvatting omzet en aantal orders.</div>
        </Link>
        <Link href="/admin/settings/mollie" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">Mollie</div>
          <div className="mt-1 text-sm text-zinc-600">API key en webhook secret.</div>
        </Link>
        <Link href="/admin/settings/cost-groups" className="rounded-lg border border-zinc-200 bg-white p-6 hover:bg-zinc-50">
          <div className="font-medium">Kostengroepen</div>
          <div className="mt-1 text-sm text-zinc-600">Kostengroepen beheren.</div>
        </Link>
      </div>
    </div>
  );
}
