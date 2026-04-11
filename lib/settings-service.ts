import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { SettingsKey } from "@/lib/settings";

/** Leest settings met service role (o.a. checkout/webhook zonder ingelogde user). */
export async function getSettingService(key: SettingsKey) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value ?? {}) as unknown;
}

export async function upsertSettingService(key: SettingsKey, value: unknown) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("settings").upsert({ key, value });
  if (error) throw error;
}
