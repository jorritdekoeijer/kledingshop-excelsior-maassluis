import { cache } from "react";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { parseHomepageSettings, type HomepageSettings } from "@/lib/validation/homepage";

/**
 * Homepage-config voor publiek (logo, hero, tegels).
 * Leest met service role zodat anonieme bezoekers de data krijgen zonder aparte RLS op `settings`
 * (werkt direct op productie; migratie 0010 blijft nuttig als je ooit met anon-client leest).
 */
async function fetchHomepageValue(): Promise<unknown> {
  const svc = createSupabaseServiceClient();
  const { data, error } = await svc.from("settings").select("value").eq("key", "homepage").maybeSingle();
  if (error) throw error;
  return data?.value ?? {};
}

/** Zelfde request deelt één fetch (o.a. homepage + header). */
export const loadHomepageSettings = cache(async (): Promise<HomepageSettings> => {
  try {
    return parseHomepageSettings(await fetchHomepageValue());
  } catch {
    return parseHomepageSettings({});
  }
});

export const HOMEPAGE_FALLBACK = {
  bannerLines: [
    "Officiële kleding en merchandise voor Excelsior Maassluis",
    "Bestellen zonder account — ook voor staf en supporters",
    "Beheer van de shop: alleen voor de kledingcommissie (inloggen)"
  ],
  heroTitle: "Clubkleding\n& merchandise",
  heroSubtitle: "Voor leden, supporters en staf: bestel direct — geen account nodig."
} as const;
