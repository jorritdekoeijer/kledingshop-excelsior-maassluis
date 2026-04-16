import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const SettingsKeySchema = z.enum(["smtp", "mollie", "monthly_email", "homepage", "order_emails"]);
export type SettingsKey = z.infer<typeof SettingsKeySchema>;

export async function getSetting(key: SettingsKey) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value ?? {}) as unknown;
}

export async function upsertSetting(key: SettingsKey, value: unknown) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("settings").upsert({ key, value });
  if (error) throw error;
}

