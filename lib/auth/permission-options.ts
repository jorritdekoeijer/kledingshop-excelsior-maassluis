/**
 * Vaste volgorde + labels voor het gebruikersrechten-scherm.
 * Technische keys blijven gelijk aan `permissions` in de database.
 */
export type PermissionOptionGroup = {
  title: string;
  description?: string;
  options: {
    key: string;
    label: string;
    hint?: string;
  }[];
};

export const PERMISSION_OPTION_GROUPS: PermissionOptionGroup[] = [
  {
    title: "Algemeen beheer",
    description: "Snel volledige toegang tot het commissie-dashboard, of kies hieronder per onderdeel.",
    options: [
      {
        key: "dashboard:access",
        label: "Heel het beheer (alle onderdelen)",
        hint: "Zelfde als onderstaande vinkjes combineren; praktisch voor hoofdbeheerders."
      }
    ]
  },
  {
    title: "Collega’s en accounts",
    options: [
      { key: "users:read", label: "Wie mag inloggen bekijken", hint: "Lijst met commissieleden en hun rechten." },
      { key: "users:write", label: "Rechten van collega’s wijzigen", hint: "Vinkjes voor anderen aanpassen." }
    ]
  },
  {
    title: "Instellingen van de shop",
    options: [
      {
        key: "settings:read",
        label: "E-mail, betaling en overige instellingen bekijken",
        hint: "Onder andere SMTP, Mollie en periodieke mails."
      },
      {
        key: "settings:write",
        label: "E-mail, betaling en overige instellingen wijzigen",
        hint: "Nieuwe API-keys of mailserver instellen."
      }
    ]
  },
  {
    title: "Kostengroepen",
    options: [
      { key: "cost_groups:read", label: "Kostengroepen bekijken" },
      { key: "cost_groups:write", label: "Kostengroepen toevoegen, hernoemen of verwijderen" }
    ]
  },
  {
    title: "Producten en catalogus",
    options: [
      { key: "products:read", label: "Producten en prijzen bekijken" },
      {
        key: "products:write",
        label: "Producten, prijzen en categorieën bewerken",
        hint: "Ook nieuwe producten en afbeeldingen."
      }
    ]
  },
  {
    title: "Voorraad",
    options: [
      { key: "stock:read", label: "Voorraad bekijken" },
      { key: "stock:write", label: "Voorraad bijwerken", hint: "Batches en verbruik (FIFO)." }
    ]
  },
  {
    title: "Bestellingen",
    options: [
      { key: "orders:read", label: "Bestellingen bekijken" },
      {
        key: "orders:write",
        label: "Bestellingen afhandelen",
        hint: "Status aanpassen en bevestigingsmail sturen."
      }
    ]
  }
];

export const ALL_KNOWN_PERMISSION_KEYS = PERMISSION_OPTION_GROUPS.flatMap((g) => g.options.map((o) => o.key));
