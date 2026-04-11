type Props = {
  categorySlug?: string;
  defaultQuery?: string;
};

/** GET-form: `/shop?q=…` en optioneel `&c=…`. */
export function ShopSearchBar({ categorySlug, defaultQuery = "" }: Props) {
  return (
    <form action="/shop" method="get" className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-center">
      {categorySlug ? <input type="hidden" name="c" value={categorySlug} /> : null}
      <label className="sr-only" htmlFor="shop-q">
        Zoeken in assortiment
      </label>
      <input
        id="shop-q"
        name="q"
        type="search"
        defaultValue={defaultQuery}
        placeholder="Zoek op naam of omschrijving…"
        maxLength={80}
        className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        autoComplete="off"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Zoeken
        </button>
        {defaultQuery ? (
          <a
            href={categorySlug ? `/shop?c=${encodeURIComponent(categorySlug)}` : "/shop"}
            className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Wis
          </a>
        ) : null}
      </div>
    </form>
  );
}
