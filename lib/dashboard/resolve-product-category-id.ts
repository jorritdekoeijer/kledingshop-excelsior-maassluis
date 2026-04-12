import { PUBLIC_PRODUCT_CATEGORIES_TABLE } from "@/lib/db/public-tables";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/**
 * Voorkomt FK-fout op products_category_id_fkey: alleen bestaande categorie-id's.
 */
export async function resolveProductCategoryId(
  service: ServiceClient,
  categoryId: string | null | undefined
): Promise<{ ok: true; category_id: string } | { ok: false; message: string }> {
  if (categoryId == null || categoryId === "") {
    return { ok: false, message: "Kies een categorie." };
  }

  const { data, error } = await service
    .from(PUBLIC_PRODUCT_CATEGORIES_TABLE)
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: `Categorie kon niet gecontroleerd worden: ${error.message}` };
  }

  if (!data) {
    return {
      ok: false,
      message:
        "De gekozen categorie bestaat niet in de database. Kies een andere categorie of maak deze aan onder Dashboard → Producten → Categorieën."
    };
  }

  return { ok: true, category_id: data.id };
}
