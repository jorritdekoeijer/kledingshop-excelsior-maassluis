import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { ProductSetComponentInput } from "@/lib/validation/products";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/**
 * Vervang de componenten van een set-product.
 * - Als isSet false: alle componenten worden verwijderd (set werd uitgezet).
 * - Als isSet true: bestaande regels worden gewist en de meegegeven componenten opnieuw geschreven.
 * - Componenten mogen NIET naar het set-product zelf verwijzen.
 * - Component-product moet bestaan en mag zelf geen set zijn.
 */
export async function replaceProductSetComponents(
  service: ServiceClient,
  setProductId: string,
  isSet: boolean,
  components: ProductSetComponentInput[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSet) {
    const { error } = await service
      .from("product_set_components")
      .delete()
      .eq("set_product_id", setProductId);
    if (error) return { ok: false, message: `Componenten verwijderen mislukt: ${error.message}` };
    return { ok: true };
  }

  if (components.length === 0) {
    return { ok: false, message: "Voeg minstens één component toe aan de productset." };
  }

  const ids = [...new Set(components.map((c) => c.componentProductId))];
  if (ids.includes(setProductId)) {
    return { ok: false, message: "Een set mag niet zichzelf als component bevatten." };
  }

  const { data: comps, error: compsErr } = await service
    .from("products")
    .select("id,is_set,active")
    .in("id", ids);
  if (compsErr) return { ok: false, message: `Componenten ophalen mislukt: ${compsErr.message}` };

  const byId = new Map((comps ?? []).map((p) => [p.id, p]));
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) return { ok: false, message: "Een gekozen component bestaat niet (meer)." };
    if (p.is_set) return { ok: false, message: "Een set mag geen andere set als component hebben." };
  }

  const { error: delErr } = await service
    .from("product_set_components")
    .delete()
    .eq("set_product_id", setProductId);
  if (delErr) return { ok: false, message: `Componenten resetten mislukt: ${delErr.message}` };

  const rows = components.map((c, i) => ({
    set_product_id: setProductId,
    component_product_id: c.componentProductId,
    quantity: c.quantity,
    sort_order: c.sortOrder ?? i,
    note: (c.note ?? "").trim() || null,
    option_group: (c.optionGroup ?? "").trim() || null,
    option_group_label: (c.optionGroupLabel ?? "").trim() || null
  }));
  let { error: insErr } = await service.from("product_set_components").insert(rows);
  if (insErr) {
    const msg = String(insErr.message ?? "").toLowerCase();
    const code = String((insErr as any).code ?? "");
    // Schemafallback: oude DB zonder de nieuwe kolommen — opnieuw zonder die velden proberen.
    if (code === "42703" || msg.includes("option_group_label")) {
      const rowsNoLabel = rows.map(({ option_group_label: _ignored, ...rest }) => rest);
      const retry = await service.from("product_set_components").insert(rowsNoLabel);
      insErr = retry.error;
      if (insErr) {
        const m2 = String(insErr.message ?? "").toLowerCase();
        const c2 = String((insErr as any).code ?? "");
        if (c2 === "42703" || m2.includes("option_group")) {
          const rowsLegacy = rowsNoLabel.map(({ option_group: _ignored, ...rest }) => rest);
          const retry2 = await service.from("product_set_components").insert(rowsLegacy);
          insErr = retry2.error;
        }
      }
    } else if (msg.includes("option_group")) {
      const rowsLegacy = rows.map(({ option_group: _g, option_group_label: _l, ...rest }) => rest);
      const retry = await service.from("product_set_components").insert(rowsLegacy);
      insErr = retry.error;
    }
  }
  if (insErr) return { ok: false, message: `Componenten opslaan mislukt: ${insErr.message}` };

  return { ok: true };
}
