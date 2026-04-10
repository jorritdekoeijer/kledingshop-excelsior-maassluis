import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { getSetting, upsertSetting } from "@/lib/settings";
import { mollieSettingsSchema } from "@/lib/validation/settings";

async function saveMollie(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.settings.write);
  if (!gate.ok) redirect("/dashboard/settings/mollie?error=Geen%20toegang");

  const parsed = mollieSettingsSchema.safeParse({
    apiKey: formData.get("apiKey"),
    webhookSecret: formData.get("webhookSecret")
  });
  if (!parsed.success) redirect(`/dashboard/settings/mollie?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid")}`);

  await upsertSetting("mollie", parsed.data);
  redirect("/dashboard/settings/mollie?ok=1");
}

export default async function MollieSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.settings.read);
  if (!gate.ok) redirect("/dashboard/settings");

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ? true : false;
  const error = typeof sp.error === "string" ? sp.error : "";

  const existing = (await getSetting("mollie")) as Partial<Record<string, unknown>>;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Mollie</h1>
      <p className="mt-2 text-sm text-zinc-600">API key en webhook secret voor verificatie.</p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form action={saveMollie} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-sm text-zinc-700">API key</span>
          <input
            name="apiKey"
            defaultValue={String(existing.apiKey ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm text-zinc-700">Webhook secret</span>
          <input
            name="webhookSecret"
            defaultValue={String(existing.webhookSecret ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
          Opslaan
        </button>
      </form>
    </div>
  );
}

