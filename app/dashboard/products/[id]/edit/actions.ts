import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions-server";
import { permissions } from "@/lib/auth/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatPostgrestError } from "@/lib/supabase/format-postgrest-error";

export async function setProductInactiveAction(productId: string) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const service = createSupabaseServiceClient();
  const { error } = await service.from("products").update({ active: false }).eq("id", productId);
  if (error) redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(error))}`);

  redirect(`/dashboard/products/${productId}/edit?ok=1`);
}

export async function deleteProductHardAction(productId: string) {
  "use server";
  const gate = await requirePermission(permissions.products.write);
  if (!gate.ok) redirect(`/dashboard/products/${productId}/edit?error=Geen%20toegang`);

  const service = createSupabaseServiceClient();

  // Veiligheidscheck: alleen toestaan als het product nergens “echt” gebruikt is.
  const [oi, sb, sol, iol] = await Promise.all([
    service.from("order_items").select("*", { count: "exact", head: true }).eq("product_id", productId),
    service.from("stock_batches").select("*", { count: "exact", head: true }).eq("product_id", productId),
    service.from("supplier_order_lines").select("*", { count: "exact", head: true }).eq("product_id", productId),
    service.from("internal_order_lines").select("*", { count: "exact", head: true }).eq("product_id", productId)
  ]);

  const blockers: string[] = [];
  if (oi.error) blockers.push(`order_items check: ${oi.error.message}`);
  if (sb.error) blockers.push(`stock_batches check: ${sb.error.message}`);
  if (sol.error) blockers.push(`supplier_order_lines check: ${sol.error.message}`);
  if (iol.error) blockers.push(`internal_order_lines check: ${iol.error.message}`);

  const usedCounts = [
    { label: "bestellingen", count: oi.count ?? 0 },
    { label: "voorraadbatches", count: sb.count ?? 0 },
    { label: "leveranciersbestellingen", count: sol.count ?? 0 },
    { label: "interne bestellingen", count: iol.count ?? 0 }
  ].filter((x) => x.count > 0);

  if (blockers.length > 0 || usedCounts.length > 0) {
    const msg =
      usedCounts.length > 0
        ? `Kan niet definitief verwijderen: product is al gekoppeld aan ${usedCounts
            .map((x) => `${x.count}× ${x.label}`)
            .join(", ")}. Zet het product inactief in plaats daarvan.`
        : `Kan niet definitief verwijderen: ${blockers.join(" · ")}`;
    redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(msg)}`);
  }

  // Verwijder images (DB + storage) en voorraadregels (cascade kan ook, maar we ruimen storage expliciet op).
  const { data: imgs, error: imgSelErr } = await service
    .from("product_images")
    .select("path")
    .eq("product_id", productId);
  if (imgSelErr) redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(imgSelErr))}`);

  const paths = (imgs ?? []).map((r) => (r as any).path).filter((p) => typeof p === "string" && p.length > 0);
  if (paths.length > 0) {
    const del = await service.storage.from("product-images").remove(paths);
    if (del.error) {
      redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(del.error.message)}`);
    }
  }

  const rrDel = await service.from("stock_reorder_rules").delete().eq("product_id", productId);
  if (rrDel.error) redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(rrDel.error))}`);

  const prodDel = await service.from("products").delete().eq("id", productId);
  if (prodDel.error) redirect(`/dashboard/products/${productId}/edit?error=${encodeURIComponent(formatPostgrestError(prodDel.error))}`);

  redirect(`/dashboard/products?ok=deleted`);
}

