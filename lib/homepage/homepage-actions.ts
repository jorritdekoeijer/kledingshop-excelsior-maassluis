"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminOrPermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { upsertSetting } from "@/lib/settings";
import { settingsSectionBase } from "@/lib/settings/settings-base";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { homepageSettingsSchema, parseHomepageSettings, type HomepageSettings } from "@/lib/validation/homepage";

function extFromFile(file: File): string {
  const n = file.name.split(".").pop()?.toLowerCase();
  if (n && /^[a-z0-9]{2,5}$/.test(n)) return n;
  return "jpg";
}

async function uploadHomeAsset(
  service: ReturnType<typeof createSupabaseServiceClient>,
  file: File,
  folder: string
): Promise<string | null> {
  if (!(file instanceof File) || file.size <= 0) return null;
  const ext = extFromFile(file);
  const path = `homepage/${folder}/${randomUUID()}.${ext}`;
  const { error } = await service.storage.from("product-images").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream"
  });
  if (error) throw new Error(error.message);
  return path;
}

async function removeStoragePath(service: ReturnType<typeof createSupabaseServiceClient>, path: string | null | undefined) {
  if (!path?.trim()) return;
  await service.storage.from("product-images").remove([path]);
}

export async function saveHomepageSettings(formData: FormData) {
  const base = settingsSectionBase(formData);
  const gate = await requireAdminOrPermission(permissions.settings.write);
  if (!gate.ok) redirect(`${base}/homepage?error=${encodeURIComponent("Geen toegang")}`);

  const supabase = await createSupabaseServerClient();
  const service = createSupabaseServiceClient();

  const { data: row, error: loadErr } = await supabase.from("settings").select("value").eq("key", "homepage").maybeSingle();
  if (loadErr) redirect(`${base}/homepage?error=${encodeURIComponent(loadErr.message)}`);

  const prev = parseHomepageSettings(row?.value);

  const bannerLine1 = String(formData.get("bannerLine1") ?? "").trim().slice(0, 280);
  const bannerLine2 = String(formData.get("bannerLine2") ?? "").trim().slice(0, 280);
  const bannerLine3 = String(formData.get("bannerLine3") ?? "").trim().slice(0, 280);
  const bannerEnabled1 = formData.get("bannerEnabled1") === "on";
  const bannerEnabled2 = formData.get("bannerEnabled2") === "on";
  const bannerEnabled3 = formData.get("bannerEnabled3") === "on";

  const heroTitle = String(formData.get("heroTitle") ?? "").trim().slice(0, 400);
  const heroSubtitle = String(formData.get("heroSubtitle") ?? "").trim().slice(0, 500);

  let logoPath = prev.logoPath ?? null;
  if (formData.get("clearLogo") === "on") {
    await removeStoragePath(service, logoPath);
    logoPath = null;
  } else {
    const logoFile = formData.get("logo");
    if (logoFile instanceof File && logoFile.size > 0) {
      await removeStoragePath(service, logoPath);
      const up = await uploadHomeAsset(service, logoFile, "logo");
      if (up) logoPath = up;
    }
  }

  let heroBannerPath = prev.heroBannerPath ?? null;
  if (formData.get("clearHeroBanner") === "on") {
    await removeStoragePath(service, heroBannerPath);
    heroBannerPath = null;
  } else {
    const heroFile = formData.get("heroBanner");
    if (heroFile instanceof File && heroFile.size > 0) {
      await removeStoragePath(service, heroBannerPath);
      const up = await uploadHomeAsset(service, heroFile, "hero");
      if (up) heroBannerPath = up;
    }
  }

  const tiles: HomepageSettings["tiles"] = [];
  for (let i = 0; i < 4; i++) {
    const catRaw = String(formData.get(`tile${i}_category`) ?? "").trim();
    const categoryId = z.string().uuid().safeParse(catRaw).success ? catRaw : null;

    let imagePath = prev.tiles[i]?.imagePath ?? null;
    if (formData.get(`tile${i}_clearImage`) === "on") {
      await removeStoragePath(service, imagePath);
      imagePath = null;
    }
    const tileFile = formData.get(`tile${i}_image`);
    if (tileFile instanceof File && tileFile.size > 0) {
      await removeStoragePath(service, imagePath);
      const up = await uploadHomeAsset(service, tileFile, `tile-${i}`);
      if (up) imagePath = up;
    }
    tiles.push({ categoryId, imagePath });
  }

  const next = homepageSettingsSchema.parse({
    bannerLine1,
    bannerLine2,
    bannerLine3,
    bannerEnabled1,
    bannerEnabled2,
    bannerEnabled3,
    logoPath,
    heroBannerPath,
    heroTitle,
    heroSubtitle,
    tiles
  });

  try {
    await upsertSetting("homepage", next);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Opslaan mislukt";
    redirect(`${base}/homepage?error=${encodeURIComponent(msg)}`);
  }

  redirect(`${base}/homepage?ok=1`);
}
