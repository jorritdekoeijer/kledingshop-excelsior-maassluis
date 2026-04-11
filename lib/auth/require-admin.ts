import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
  if (!rpcError && isAdmin === true) {
    return { ok: true as const, user: data.user };
  }

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error || !roles || roles.length === 0) return { ok: false as const, user: data.user };
  return { ok: true as const, user: data.user };
}

