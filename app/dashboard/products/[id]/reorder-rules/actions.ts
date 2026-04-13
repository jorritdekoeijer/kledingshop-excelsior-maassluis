"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";
import { upsertReorderRulesSchema } from "@/lib/validation/reorder-rules";

function parseJsonField(raw: FormDataEntryValue | null, fallback: unknown): unknown {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }
}

export async function updateReorderRules(productId: string, formData: FormData) {
  const gate = await requirePermission(permissions.stock.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const rawRules = parseJsonField(formData.get("rulesJson"), []);
  const parsed = upsertReorderRulesSchema.safeParse({
    productId,
    rules: rawRules
  });
  if (!parsed.success) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ongeldige invoer")}`);
  }

  const service = createSupabaseServiceClient();

  // Upsert alle regels; UI stuurt ook inactieve mee, zodat je ze snel weer kunt activeren.
  const rows = parsed.data.rules.map((r) => ({
    product_id: productId,
    variant_segment: r.variantSegment,
    size_label: r.sizeLabel,
    is_active: r.isActive,
    threshold_qty: r.thresholdQty,
    target_qty: r.targetQty
  }));

  const { error } = await service.from("stock_reorder_rules").upsert(rows, {
    onConflict: "product_id,variant_segment,size_label"
  });
  if (error) {
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(error))}`);
  }

  redirect(`/dashboard/products/${productId}/edit?ok=1`);
}

