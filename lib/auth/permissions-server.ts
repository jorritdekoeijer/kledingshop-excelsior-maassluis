import { redirect } from "next/navigation";
import type { Permission } from "@/lib/auth/permissions";
import { permissions } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("user_profiles").select("permissions").eq("id", userId).single();
  if (error || !data) return [];
  return (data.permissions ?? []) as Permission[];
}

export async function requireLogin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return data.user;
}

export async function requirePermission(required: Permission) {
  const user = await requireLogin();
  const perms = await getUserPermissions(user.id);
  const admin = await requireAdmin();
  if (admin.ok && admin.user.id === user.id) {
    return { ok: true as const, user, permissions: perms, isAdmin: true as const };
  }
  if (!perms.includes(required)) {
    return { ok: false as const, user, permissions: perms, isAdmin: false as const };
  }
  return { ok: true as const, user, permissions: perms, isAdmin: false as const };
}

/** True if public.is_admin() RPC returns true (admin role in user_roles). */
export async function getIsAdmin(): Promise<boolean> {
  // Gebruik dezelfde logica als `requireAdmin` (RPC + fallback via user_roles).
  const admin = await requireAdmin();
  return admin.ok;
}

/** Zelfde als {@link requirePermission}: admins hebben impliciet alle dashboard-permissies. */
export async function requireAdminOrPermission(required: Permission) {
  return requirePermission(required);
}

/** Minstens één van de opgegeven permissies (of admin / `dashboard:access`). */
export async function requireOneOfPermissions(required: Permission[]) {
  const user = await requireLogin();
  const perms = await getUserPermissions(user.id);
  const admin = await requireAdmin();
  if (admin.ok && admin.user.id === user.id) {
    return { ok: true as const, user, permissions: perms, isAdmin: true as const };
  }
  if (required.some((r) => perms.includes(r))) {
    return { ok: true as const, user, permissions: perms, isAdmin: false as const };
  }
  return { ok: false as const, user, permissions: perms, isAdmin: false as const };
}

