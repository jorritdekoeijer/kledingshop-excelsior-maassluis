/**
 * Config voor het gebruikersrechten-scherm (vriendelijke labels + formuliervelden).
 * Technische keys blijven gelijk aan de database.
 */

export const DASHBOARD_ACCESS_KEY = "dashboard:access";

export type PermissionLevelPair = {
  /** Naam van het formulier-veld (radio group) */
  formField: string;
  title: string;
  description?: string;
  readKey: string;
  writeKey: string;
};

/** Per onderdeel: lezen en/of schrijven (los van volledig-beheer-vinkje). */
export const PERMISSION_LEVEL_PAIRS: PermissionLevelPair[] = [
  {
    formField: "level_users",
    title: "Collega’s en accounts",
    description: "Wie mag inloggen voor het beheer en welke rechten ze hebben.",
    readKey: "users:read",
    writeKey: "users:write"
  },
  {
    formField: "level_settings",
    title: "Instellingen van de shop",
    description: "E-mail (SMTP), betaling (Mollie), kostenoverzicht per mail, enz.",
    readKey: "settings:read",
    writeKey: "settings:write"
  },
  {
    formField: "level_cost_groups",
    title: "Kostengroepen",
    description: "Groepen voor kosten/verkoop per product.",
    readKey: "cost_groups:read",
    writeKey: "cost_groups:write"
  },
  {
    formField: "level_products",
    title: "Producten en catalogus",
    description: "Assortiment, prijzen, categorieën en productfoto’s.",
    readKey: "products:read",
    writeKey: "products:write"
  },
  {
    formField: "level_stock",
    title: "Voorraad",
    description: "Batches ontvangen en voorraad verbruiken (FIFO).",
    readKey: "stock:read",
    writeKey: "stock:write"
  },
  {
    formField: "level_orders",
    title: "Bestellingen",
    description: "Orders inzien en afhandelen (status, bevestiging naar klant).",
    readKey: "orders:read",
    writeKey: "orders:write"
  }
];

export const ALL_KNOWN_PERMISSION_KEYS = [
  DASHBOARD_ACCESS_KEY,
  ...PERMISSION_LEVEL_PAIRS.flatMap((p) => [p.readKey, p.writeKey])
];

export type AccessLevel = "none" | "read" | "write";

/** Bepaal welke radioknop hoort bij de huidige permissies. */
export function accessLevelForPair(
  perms: ReadonlySet<string>,
  readKey: string,
  writeKey: string
): AccessLevel {
  if (perms.has(writeKey)) return "write";
  if (perms.has(readKey)) return "read";
  return "none";
}
