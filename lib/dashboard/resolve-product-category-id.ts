import { createSupabaseServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/**
 * Voorkomt FK-fout op products_category_id_fkey: alleen bestaande categorie-id's,
 * anders null of een duidelijke foutmelding.
 */
export async function resolveProductCategoryId(
  service: ServiceClient,
  categoryId: string | null | undefined
): Promise<{ ok: true; category_id: string | null } | { ok: false; message: string }> {
  if (categoryId == null || categoryId === "") {
    return { ok: true, category_id: null };
  }

  const { data, error } = await service.from("categories").select("id").eq("id", categoryId).maybeSingle();

  if (error) {
    return { ok: false, message: `Categorie kon niet gecontroleerd worden: ${error.message}` };
  }

  if (!data) {
    return {
      ok: false,
      message:
        "De gekozen categorie bestaat niet in de database. Kies “(geen)” of maak de categorie aan onder Dashboard → Producten → Categorieën."
    };
  }

  return { ok: true, category_id: data.id };
}
