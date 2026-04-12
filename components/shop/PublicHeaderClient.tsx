"use client";

import Link from "next/link";
import { useCart } from "@/components/shop/cart/CartContext";

export function PublicHeaderClient({
  isLoggedIn,
  logoUrl
}: {
  isLoggedIn: boolean;
  logoUrl: string | null;
}) {
  const { totalQuantity } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white shadow-[0_0_1px_rgba(0,0,0,0.2)]">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="min-w-0 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Excelsior Maassluis" className="h-10 max-h-12 w-auto max-w-[220px] object-contain" />
          ) : (
            <>
              <span className="block truncate text-lg font-semibold tracking-tight text-brand-blue sm:text-xl">
                Excelsior Maassluis
              </span>
              <span className="hidden text-[10px] font-normal uppercase tracking-[0.2em] text-zinc-500 sm:block">
                Kledingshop
              </span>
            </>
          )}
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[11px] font-medium uppercase tracking-[0.2em] text-black sm:gap-x-8 sm:text-xs">
          <Link href="/shop" className="hover:text-brand-blue">
            Assortiment
          </Link>
          <Link href="/cart" className="hover:text-brand-blue">
            Winkelmand
            {totalQuantity > 0 ? (
              <span className="ml-1 rounded-full bg-brand-red px-1.5 py-0.5 text-[10px] font-semibold text-white normal-case tracking-normal">
                {totalQuantity}
              </span>
            ) : null}
          </Link>
          <Link href="/#over-de-shop" className="hidden hover:text-brand-blue md:inline">
            Over de shop
          </Link>
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="hover:text-brand-blue">
                Dashboard
              </Link>
              <form action="/logout" method="post" className="inline">
                <button
                  type="submit"
                  className="rounded-none border border-zinc-300 px-3 py-1.5 text-[11px] font-medium normal-case tracking-normal text-zinc-900 hover:bg-zinc-50"
                >
                  Uitloggen
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="hover:text-brand-blue"
              title="Alleen voor medewerkers van de kledingcommissie"
            >
              Commissie
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
