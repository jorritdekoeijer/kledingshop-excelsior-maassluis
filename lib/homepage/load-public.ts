import { cache } from "react";
import { getSetting } from "@/lib/settings";
import { parseHomepageSettings, type HomepageSettings } from "@/lib/validation/homepage";

/** Zelfde request deelt één fetch (o.a. homepage + header). */
export const loadHomepageSettings = cache(async (): Promise<HomepageSettings> => {
  try {
    const raw = await getSetting("homepage");
    return parseHomepageSettings(raw);
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
