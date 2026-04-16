export const permissions = {
  dashboard: {
    access: "dashboard:access"
  },
  users: {
    read: "users:read",
    write: "users:write"
  },
  settings: {
    read: "settings:read",
    write: "settings:write"
  },
  costGroups: {
    read: "cost_groups:read",
    write: "cost_groups:write"
  },
  products: {
    read: "products:read",
    write: "products:write"
  },
  stock: {
    read: "stock:read",
    write: "stock:write"
  },
  orders: {
    read: "orders:read",
    write: "orders:write"
  },
  /** Order picken/packen (te maken bestellingen). */
  orderPick: {
    read: "order_pick:read",
    write: "order_pick:write"
  },
  /** Afhalen afhandeling (af te halen bestellingen). */
  orderPickup: {
    read: "order_pickup:read",
    write: "order_pickup:write"
  },
  /** Financiële rapportage (omzet, marge, voorraadwaarde, kostengroepen). */
  reporting: {
    read: "reporting:read",
    write: "reporting:write"
  },
  /** Leveranciersgegevens (NAW, e-mail) voor leveranciersbestellingen. */
  suppliers: {
    read: "suppliers:read",
    write: "suppliers:write"
  },
  admin: {
    view: "admin:view",
    manageOrders: "orders:manage",
    manageProducts: "products:manage"
  }
} as const;

// Keep this permissive (string) so route gating stays simple.
// The canonical values live in `permissions` above.
export type Permission = string;

export type Role = "admin" | "customer";

export function hasPermission(userPermissions: readonly Permission[], required: Permission) {
  return userPermissions.includes(required);
}


