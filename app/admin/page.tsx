import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Forbidden</h1>
        <p className="mt-2 text-sm text-zinc-600">Je hebt geen adminrechten.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2 text-sm text-zinc-600">Welkom, {admin.user.email ?? admin.user.id}.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="rounded-md border border-zinc-300 px-3 py-2 text-sm" href="/admin/roles">
          Rollen beheren
        </Link>
        <Link className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" href="/admin/settings">
          Instellingen
        </Link>
      </div>
    </div>
  );
}
