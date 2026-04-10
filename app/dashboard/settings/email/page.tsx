import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { getSetting, upsertSetting } from "@/lib/settings";
import { smtpSettingsSchema } from "@/lib/validation/settings";

async function saveSmtp(formData: FormData) {
  "use server";
  const gate = await requirePermission(permissions.settings.write);
  if (!gate.ok) redirect("/dashboard/settings/email?error=Geen%20toegang");

  const parsed = smtpSettingsSchema.safeParse({
    host: formData.get("host"),
    port: formData.get("port"),
    secure: formData.get("secure"),
    user: formData.get("user"),
    pass: formData.get("pass"),
    from: formData.get("from")
  });
  if (!parsed.success) redirect(`/dashboard/settings/email?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid")}`);

  await upsertSetting("smtp", parsed.data);
  redirect("/dashboard/settings/email?ok=1");
}

export default async function EmailSettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await requirePermission(permissions.settings.read);
  if (!gate.ok) redirect("/dashboard/settings");

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ? true : false;
  const error = typeof sp.error === "string" ? sp.error : "";

  const existing = (await getSetting("smtp")) as Partial<Record<string, unknown>>;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">E-mail (SMTP)</h1>
      <p className="mt-2 text-sm text-zinc-600">Deze gegevens worden gebruikt door Nodemailer.</p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form action={saveSmtp} className="mt-6 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-sm text-zinc-700">Host</span>
          <input
            name="host"
            defaultValue={String(existing.host ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Port</span>
          <input
            name="port"
            defaultValue={String(existing.port ?? "587")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Secure (true/false)</span>
          <input
            name="secure"
            defaultValue={String(existing.secure ?? "false")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">User</span>
          <input
            name="user"
            defaultValue={String(existing.user ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Pass</span>
          <input
            name="pass"
            type="password"
            defaultValue={String(existing.pass ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">From (email)</span>
          <input
            name="from"
            defaultValue={String(existing.from ?? "")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="md:col-span-2">
          <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
            Opslaan
          </button>
        </div>
      </form>
    </div>
  );
}

