import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";

export default async function InterneBestellingPage() {
  const gate = await requirePermission(permissions.stock.read);
  if (!gate.ok) redirect("/dashboard/stock?error=Geen%20toegang");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/dashboard/stock" className="text-sm text-brand-blue hover:underline">
        ← Terug naar voorraad
      </Link>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Interne bestelling</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Deze functie is nog niet geconfigureerd. Gebruik voor nu <strong>Nieuwe levering</strong> voor
          inkopen, of neem contact op met de beheerder.
        </p>
      </div>
    </div>
  );
}
