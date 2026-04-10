export const permissions = {
  admin: {
    view: "admin:view",
    manageOrders: "orders:manage",
    manageProducts: "products:manage"
  }
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions][keyof (typeof permissions)[keyof typeof permissions]];

export type Role = "admin" | "customer";

export function hasPermission(userPermissions: readonly Permission[], required: Permission) {
  return userPermissions.includes(required);
}


