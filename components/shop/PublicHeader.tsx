import { PublicHeaderClient } from "@/components/shop/PublicHeaderClient";
import { loadHomepageSettings } from "@/lib/homepage/load-public";
import { getPublicProductImageUrl } from "@/lib/utils/supabase-storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PublicHeader() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const hp = await loadHomepageSettings();
  const logoUrl = getPublicProductImageUrl(hp.logoPath ?? null);

  return <PublicHeaderClient isLoggedIn={!!data.user} logoUrl={logoUrl} />;
}
