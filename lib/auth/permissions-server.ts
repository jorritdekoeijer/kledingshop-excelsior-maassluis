import { redirect } from "next/navigation";
import type { Permission } from "@/lib/auth/permissions";
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
  if (!perms.includes(required)) return { ok: false as const, user, permissions: perms };
  return { ok: true as const, user, permissions: perms };
}

