import Link from "next/link";
import { saveHomepageSettings } from "@/lib/homepage/homepage-actions";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";
import type { HomepageSettings } from "@/lib/validation/homepage";
import { SettingsBaseHidden } from "@/components/settings/SettingsBaseHidden";

type Cat = { id: string; name: string; slug: string };

export async function HomepageSettingsSection({
  base,
  config,
  ok,
  error,
  categories
}: {
  base: SettingsSectionBase;
  config: HomepageSettings;
  ok: boolean;
  error: string;
  categories: Cat[];
}) {
  const hub =
    base === "/admin/settings" ? (
      <Link href="/admin/settings" className="text-sm text-brand-blue hover:underline">
        ← Terug naar instellingen
      </Link>
    ) : (
      <Link href="/dashboard/settings" className="text-sm text-brand-blue hover:underline">
        ← Terug naar instellingen
      </Link>
    );

  const logoPreview = getPublicProductImageUrl(config.logoPath ?? null);
  const heroPreview = getPublicProductImageUrl(config.heroBannerPath ?? null);

  return (
    <div className="space-y-6">
      <nav>{hub}</nav>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Homepage</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Bovenste banner, logo in de menubalk, grote foto achter de titel (aanbevolen 1920×1080 px), teksten in de
          hoofdbalk en vier tegels naar productcategorieën (vierkante foto’s, bijv. 800×800 px).
        </p>

        {ok ? (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Opgeslagen.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <form action={saveHomepageSettings} encType="multipart/form-data" className="mt-8 space-y-10">
          <SettingsBaseHidden value={base} />

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-900">Topbanner (drie regels)</h2>
            <p className="text-xs text-zinc-600">Welke regels in de rotatie tonen — vink uit om een regel over te slaan.</p>
            {(
              [
                { line: "bannerLine1", en: "bannerEnabled1", val: config.bannerLine1, on: config.bannerEnabled1 },
                { line: "bannerLine2", en: "bannerEnabled2", val: config.bannerLine2, on: config.bannerEnabled2 },
                { line: "bannerLine3", en: "bannerEnabled3", val: config.bannerLine3, on: config.bannerEnabled3 }
              ] as const
            ).map((row, i) => (
              <div
                key={row.line}
                className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 sm:flex-row sm:items-start"
              >
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={row.en}
                    defaultChecked={row.on}
                    className="h-4 w-4 rounded border-zinc-300 text-brand-blue"
                  />
                  <span>Regel {i + 1} tonen</span>
                </label>
                <input
                  name={row.line}
                  defaultValue={row.val}
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Tekst voor deze regel"
                />
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">Logo (menubalk)</h2>
            <p className="text-xs text-zinc-600">PNG of SVG met transparante achtergrond werkt het beste.</p>
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Huidig logo" className="h-12 w-auto max-w-[200px] object-contain" />
            ) : null}
            <input name="logo" type="file" accept="image/*" className="block text-sm" />
            {config.logoPath ? (
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" name="clearLogo" className="h-4 w-4 rounded border-zinc-300" />
                Logo verwijderen
              </label>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">Achtergrondfoto hero (aanbevolen 1920×1080)</h2>
            {heroPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroPreview} alt="" className="max-h-48 w-full max-w-xl rounded-md object-cover" />
            ) : null}
            <input name="heroBanner" type="file" accept="image/*" className="block text-sm" />
            {config.heroBannerPath ? (
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" name="clearHeroBanner" className="h-4 w-4 rounded border-zinc-300" />
                Foto verwijderen (gradient blijft zichtbaar)
              </label>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">Hero-gradient</h2>
            <p className="text-xs text-zinc-600">
              Positie van de middelste kleur in de diagonale gradient (0% = meer naar linkboven, 100% = meer naar
              rechtsonder). Geldt voor de donkere laag over een achtergrondfoto én voor de gradient zonder foto.
            </p>
            <div className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="range"
                name="heroGradientMidStopPercent"
                min={0}
                max={100}
                step={1}
                defaultValue={config.heroGradientMidStopPercent}
                className="h-2 w-full cursor-pointer accent-brand-blue"
              />
              <span className="shrink-0 text-sm tabular-nums text-zinc-700">
                {config.heroGradientMidStopPercent}% middenstop
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Na opslaan zie je de nieuwe waarde hier; sleep de schuifregelaar en klik op &quot;Homepage opslaan&quot;.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">Hoofdtitel en ondertitel</h2>
            <label className="block text-sm">
              <span className="text-zinc-700">Titel (meerdere regels met Enter)</span>
              <textarea
                name="heroTitle"
                rows={3}
                defaultValue={config.heroTitle}
                className="mt-1 w-full max-w-xl rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Clubkleding&#10;& merchandise"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-700">Ondertitel (korte intro onder de titel)</span>
              <textarea
                name="heroSubtitle"
                rows={2}
                defaultValue={config.heroSubtitle}
                className="mt-1 w-full max-w-xl rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </section>

          <section className="space-y-6">
            <h2 className="text-sm font-semibold text-zinc-900">Vier tegels (productgroepen)</h2>
            <p className="text-xs text-zinc-600">
              Kies per tegel een categorie uit het assortiment en upload een vierkante afbeelding. Categorieën beheer je
              onder Producten → Categorieën.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => {
                const tile = config.tiles[i] ?? {};
                const img = getPublicProductImageUrl(tile.imagePath ?? null);
                return (
                  <fieldset key={i} className="rounded-lg border border-zinc-200 p-4">
                    <legend className="px-1 text-xs font-semibold text-zinc-800">Tegel {i + 1}</legend>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="mb-3 aspect-square w-full max-w-[200px] rounded-md object-cover" />
                    ) : (
                      <div className="mb-3 flex aspect-square w-full max-w-[200px] items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-500">
                        Geen foto
                      </div>
                    )}
                    <label className="block text-sm">
                      <span className="text-zinc-700">Productcategorie</span>
                      <select
                        name={`tile${i}_category`}
                        defaultValue={tile.categoryId ?? ""}
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      >
                        <option value="">— Kies categorie —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <input name={`tile${i}_image`} type="file" accept="image/*" className="mt-3 block text-sm" />
                    {tile.imagePath ? (
                      <label className="mt-2 flex items-center gap-2 text-xs text-zinc-700">
                        <input type="checkbox" name={`tile${i}_clearImage`} className="h-4 w-4 rounded border-zinc-300" />
                        Foto verwijderen
                      </label>
                    ) : null}
                  </fieldset>
                );
              })}
            </div>
          </section>

          <div className="border-t border-zinc-200 pt-6">
            <button type="submit" className="rounded-md bg-brand-blue px-5 py-2.5 text-sm font-medium text-white">
              Homepage opslaan
            </button>
          </div>
        </form>
      </div>

      <p className="text-center text-sm">
        <Link href="/" className="text-brand-blue hover:underline">
          Bekijk de homepage →
        </Link>
      </p>
    </div>
  );
}

export async function loadCategoriesForHomepageSettings(): Promise<Cat[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("categories").select("id,name,slug").order("name");
  return (data ?? []) as Cat[];
}
