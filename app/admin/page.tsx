import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Forbidden</h1>
        <p className="mt-2 text-sm text-zinc-600">Je hebt geen adminrechten.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2 text-sm text-zinc-600">Welkom, {admin.user.email ?? admin.user.id}.</p>
      <div className="mt-6">
        <Link className="rounded-md border border-zinc-300 px-3 py-2 text-sm" href="/admin/roles">
          Rollen beheren
        </Link>
      </div>
    </main>
  );
}

