import { redirect } from "next/navigation";
import { requireAdminOrPermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { OrderEmailsSettingsSection } from "@/components/settings/sections/order-emails-section";

export default async function OrderEmailsSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requireAdminOrPermission(permissions.settings.read);
  if (!gate.ok) redirect("/dashboard/settings");

  const sp = (await searchParams) ?? {};
  const ok = Boolean(sp.ok);
  const error = typeof sp.error === "string" ? sp.error : "";

  return <OrderEmailsSettingsSection base="/dashboard/settings" ok={ok} error={error} />;
}

