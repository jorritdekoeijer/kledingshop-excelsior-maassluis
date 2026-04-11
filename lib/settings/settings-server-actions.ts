"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminOrPermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { getSetting, upsertSetting } from "@/lib/settings";
import { settingsSectionBase } from "@/lib/settings/settings-base";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mollieSettingsSchema, monthlyEmailSettingsSchema, smtpSettingsSchema } from "@/lib/validation/settings";

const createCostGroupSchema = z.object({ name: z.string().min(1).max(80) });
const renameCostGroupSchema = z.object({ id: z.string().uuid(), name: z.string().min(1).max(80) });
const deleteCostGroupSchema = z.object({ id: z.string().uuid() });
const updateUserPermsSchema = z.object({
  id: z.string().uuid(),
  permissions: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    )
});

export async function saveSmtpSettings(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.settings.write);
  if (!gate.ok) redirect(`${base}/email?error=${encodeURIComponent("Geen toegang")}`);

  const parsed = smtpSettingsSchema.safeParse({
    host: formData.get("host"),
    port: formData.get("port"),
    secure: formData.get("secure"),
    user: formData.get("user"),
    pass: formData.get("pass"),
    from: formData.get("from")
  });
  if (!parsed.success) {
    redirect(`${base}/email?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldig")}`);
  }

  await upsertSetting("smtp", parsed.data);
  redirect(`${base}/email?ok=1`);
}

export async function saveMollieSettings(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.settings.write);
  if (!gate.ok) redirect(`${base}/mollie?error=${encodeURIComponent("Geen toegang")}`);

  const parsed = mollieSettingsSchema.safeParse({
    apiKey: formData.get("apiKey"),
    webhookSecret: formData.get("webhookSecret")
  });
  if (!parsed.success) {
    redirect(`${base}/mollie?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldig")}`);
  }

  await upsertSetting("mollie", parsed.data);
  redirect(`${base}/mollie?ok=1`);
}

export async function saveMonthlyEmailSettings(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.settings.write);
  if (!gate.ok) redirect(`${base}/monthly-email?error=${encodeURIComponent("Geen toegang")}`);

  const existing = (await getSetting("monthly_email")) as Record<string, unknown>;

  const parsed = monthlyEmailSettingsSchema.safeParse({
    dayOfMonth: formData.get("dayOfMonth"),
    enabled: formData.get("enabled") === "on",
    recipientEmail: String(formData.get("recipientEmail") ?? "").trim(),
    lastCompletedReportPeriod: typeof existing.lastCompletedReportPeriod === "string" ? existing.lastCompletedReportPeriod : undefined
  });

  if (!parsed.success) {
    redirect(`${base}/monthly-email?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldig")}`);
  }

  if (parsed.data.enabled && !parsed.data.recipientEmail) {
    redirect(`${base}/monthly-email?error=${encodeURIComponent("Vul een ontvanger in of schakel uit.")}`);
  }

  await upsertSetting("monthly_email", {
    ...parsed.data,
    recipientEmail: parsed.data.recipientEmail || ""
  });
  redirect(`${base}/monthly-email?ok=1`);
}

export async function createCostGroup(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.costGroups.write);
  if (!gate.ok) redirect(`${base}/cost-groups?error=${encodeURIComponent("Geen toegang")}`);

  const parsed = createCostGroupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect(`${base}/cost-groups?error=${encodeURIComponent("Ongeldige naam")}`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cost_groups").insert({ name: parsed.data.name });
  if (error) redirect(`${base}/cost-groups?error=${encodeURIComponent(error.message)}`);

  redirect(`${base}/cost-groups?ok=1`);
}

export async function renameCostGroup(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.costGroups.write);
  if (!gate.ok) redirect(`${base}/cost-groups?error=${encodeURIComponent("Geen toegang")}`);

  const parsed = renameCostGroupSchema.safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) redirect(`${base}/cost-groups?error=Invalid`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cost_groups").update({ name: parsed.data.name }).eq("id", parsed.data.id);
  if (error) redirect(`${base}/cost-groups?error=${encodeURIComponent(error.message)}`);
  redirect(`${base}/cost-groups?ok=1`);
}

export async function deleteCostGroup(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.costGroups.write);
  if (!gate.ok) redirect(`${base}/cost-groups?error=${encodeURIComponent("Geen toegang")}`);

  const parsed = deleteCostGroupSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect(`${base}/cost-groups?error=Invalid`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cost_groups").delete().eq("id", parsed.data.id);
  if (error) redirect(`${base}/cost-groups?error=${encodeURIComponent(error.message)}`);
  redirect(`${base}/cost-groups?ok=1`);
}

export async function updateUserPermissions(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.users.write);
  if (!gate.ok) redirect(`${base}/users?error=${encodeURIComponent("Geen toegang")}`);

  const parsed = updateUserPermsSchema.safeParse({
    id: formData.get("id"),
    permissions: String(formData.get("permissions") ?? "")
  });
  if (!parsed.success) redirect(`${base}/users?error=Invalid`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ permissions: parsed.data.permissions })
    .eq("id", parsed.data.id);
  if (error) redirect(`${base}/users?error=${encodeURIComponent(error.message)}`);

  redirect(`${base}/users?ok=1`);
}
