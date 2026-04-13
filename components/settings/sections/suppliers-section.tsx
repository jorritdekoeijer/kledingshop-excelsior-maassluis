import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { SettingsBaseHidden } from "@/components/settings/SettingsBaseHidden";
import { createSupplier, deleteSupplier, updateSupplier } from "@/lib/settings/suppliers-server-actions";

export async function SuppliersSettingsSection({
  base,
  ok,
  error
}: {
  base: SettingsSectionBase;
  ok: boolean;
  error: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id,name,email,phone,address_line1,address_line2,postal_code,city,country,created_at")
    .order("name");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Leveranciers</h1>
      <p className="mt-2 text-sm text-zinc-600">Beheer leveranciersgegevens (NAW + e-mail) voor leveranciersbestellingen.</p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form action={createSupplier} className="mt-6 grid gap-3 md:grid-cols-2">
        <SettingsBaseHidden value={base} />
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Naam</span>
          <input name="name" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" required />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">E-mail</span>
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Telefoon</span>
          <input name="phone" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <div className="hidden md:block" />
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Adresregel 1</span>
          <input name="address_line1" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Adresregel 2</span>
          <input name="address_line2" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Postcode</span>
          <input name="postal_code" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-700">Plaats</span>
          <input name="city" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm text-zinc-700">Land</span>
          <input name="country" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>

        <div className="md:col-span-2">
          <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
            Leverancier toevoegen
          </button>
        </div>
      </form>

      <div className="mt-8 space-y-3">
        {(suppliers ?? []).map((s) => (
          <div key={s.id} className="rounded-lg border border-zinc-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">{s.name}</div>
                <div className="mt-1 text-sm text-zinc-600">{s.email}</div>
              </div>
              <form action={deleteSupplier}>
                <SettingsBaseHidden value={base} />
                <input type="hidden" name="id" value={s.id} />
                <button className="text-sm text-brand-red hover:underline" type="submit">
                  Verwijderen
                </button>
              </form>
            </div>

            <form action={updateSupplier} className="mt-4 grid gap-3 md:grid-cols-2">
              <SettingsBaseHidden value={base} />
              <input type="hidden" name="id" value={s.id} />
              <label className="block md:col-span-2">
                <span className="text-xs text-zinc-600">Naam</span>
                <input
                  name="name"
                  defaultValue={s.name ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs text-zinc-600">E-mail</span>
                <input
                  name="email"
                  type="email"
                  defaultValue={s.email ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-600">Telefoon</span>
                <input
                  name="phone"
                  defaultValue={s.phone ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="hidden md:block" />
              <label className="block md:col-span-2">
                <span className="text-xs text-zinc-600">Adresregel 1</span>
                <input
                  name="address_line1"
                  defaultValue={s.address_line1 ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs text-zinc-600">Adresregel 2</span>
                <input
                  name="address_line2"
                  defaultValue={s.address_line2 ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-600">Postcode</span>
                <input
                  name="postal_code"
                  defaultValue={s.postal_code ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-600">Plaats</span>
                <input
                  name="city"
                  defaultValue={s.city ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs text-zinc-600">Land</span>
                <input
                  name="country"
                  defaultValue={s.country ?? ""}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="md:col-span-2">
                <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium" type="submit">
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

