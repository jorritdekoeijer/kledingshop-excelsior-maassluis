/**
 * Moet exact overeenkomen met de FK op `public.products.category_id`.
 * Veel projecten gebruiken `product_categories`; oudere migraties in deze repo noemden `categories`.
 */
export const PUBLIC_PRODUCT_CATEGORIES_TABLE = "product_categories" as const;
