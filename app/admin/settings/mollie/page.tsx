import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { MollieSettingsSection } from "@/components/settings/sections/mollie-section";

export default async function AdminMollieSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  if (!admin.ok) redirect("/admin");

  const sp = (await searchParams) ?? {};
  const ok = Boolean(sp.ok);
  const error = typeof sp.error === "string" ? sp.error : "";

  return <MollieSettingsSection base="/admin/settings" ok={ok} error={error} />;
}
