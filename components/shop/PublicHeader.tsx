import { PublicHeaderClient } from "@/components/shop/PublicHeaderClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PublicHeader() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return <PublicHeaderClient isLoggedIn={!!data.user} />;
}
