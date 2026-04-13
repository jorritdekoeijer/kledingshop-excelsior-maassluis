"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminOrPermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { settingsSectionBase } from "@/lib/settings/settings-base";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supplierCreateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().max(80).optional().nullable(),
  address_line1: z.string().max(200).optional().nullable(),
  address_line2: z.string().max(200).optional().nullable(),
  postal_code: z.string().max(32).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable()
});

const supplierUpdateSchema = supplierCreateSchema.extend({
  id: z.string().uuid()
});

const supplierDeleteSchema = z.object({ id: z.string().uuid() });

export async function createSupplier(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.settings.write);
  if (!gate.ok) redirect(`${base}/suppliers?error=${encodeURIComponent("Geen toegang")}`);

  const parsed = supplierCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address_line1: formData.get("address_line1"),
    address_line2: formData.get("address_line2"),
    postal_code: formData.get("postal_code"),
    city: formData.get("city"),
    country: formData.get("country")
  });
  if (!parsed.success) redirect(`${base}/suppliers?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldig")}`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("suppliers").insert({
    ...parsed.data,
    phone: parsed.data.phone?.trim() || null,
    address_line1: parsed.data.address_line1?.trim() || null,
    address_line2: parsed.data.address_line2?.trim() || null,
    postal_code: parsed.data.postal_code?.trim() || null,
    city: parsed.data.city?.trim() || null,
    country: parsed.data.country?.trim() || null
  });
  if (error) redirect(`${base}/suppliers?error=${encodeURIComponent(error.message)}`);

  redirect(`${base}/suppliers?ok=1`);
}

export async function updateSupplier(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.settings.write);
  if (!gate.ok) redirect(`${base}/suppliers?error=${encodeURIComponent("Geen toegang")}`);

  const parsed = supplierUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address_line1: formData.get("address_line1"),
    address_line2: formData.get("address_line2"),
    postal_code: formData.get("postal_code"),
    city: formData.get("city"),
    country: formData.get("country")
  });
  if (!parsed.success) redirect(`${base}/suppliers?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldig")}`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      ...parsed.data,
      phone: parsed.data.phone?.trim() || null,
      address_line1: parsed.data.address_line1?.trim() || null,
      address_line2: parsed.data.address_line2?.trim() || null,
      postal_code: parsed.data.postal_code?.trim() || null,
      city: parsed.data.city?.trim() || null,
      country: parsed.data.country?.trim() || null
    })
    .eq("id", parsed.data.id);
  if (error) redirect(`${base}/suppliers?error=${encodeURIComponent(error.message)}`);

  redirect(`${base}/suppliers?ok=1`);
}

export async function deleteSupplier(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.settings.write);
  if (!gate.ok) redirect(`${base}/suppliers?error=${encodeURIComponent("Geen toegang")}`);

  const parsed = supplierDeleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) redirect(`${base}/suppliers?error=Invalid`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", parsed.data.id);
  if (error) redirect(`${base}/suppliers?error=${encodeURIComponent(error.message)}`);

  redirect(`${base}/suppliers?ok=1`);
}

