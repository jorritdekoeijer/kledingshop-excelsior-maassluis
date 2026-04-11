import Link from "next/link";

function CheckIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="8" className="fill-emerald-500/20" />
      <path
        d="M4.5 8.2 7 10.7 11.5 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-600"
      />
    </svg>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 bg-[#fafafa]">
        <div className="mx-auto grid max-w-[1800px] gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <div className="flex items-start gap-3">
            <CheckIcon />
            <h2 className="text-base font-semibold leading-snug text-black">Officiële clubartikelen</h2>
          </div>
          <div className="flex items-start gap-3">
            <CheckIcon />
            <h2 className="text-base font-semibold leading-snug text-black">Bestellen zonder account</h2>
          </div>
          <div className="flex items-start gap-3">
            <CheckIcon />
            <h2 className="text-base font-semibold leading-snug text-black">Duidelijke prijzen in euro</h2>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-semibold text-brand-blue">Excelsior Maassluis</p>
            <p className="mt-2 text-sm text-zinc-600">De officiële kledingshop voor leden, supporters en staf.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-black">Klant</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/shop" className="text-zinc-700 hover:text-brand-blue">
                  Assortiment
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-zinc-700 hover:text-brand-blue">
                  Inloggen commissie
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-black">Informatie</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/#over-de-shop" className="text-zinc-700 hover:text-brand-blue">
                  Over deze shop
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-black">Nieuwsbrief</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Nieuws over collecties volgt via de clubkanalen. Deze shop focust op bestellen en afhandeling.
            </p>
          </div>
        </div>

        <p className="mt-10 border-t border-zinc-200 pt-8 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Kledingshop Excelsior Maassluis
        </p>
      </div>
    </footer>
  );
}
