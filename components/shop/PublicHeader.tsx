import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PublicHeader() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-brand-blue">
          Excelsior Maassluis
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 text-sm sm:gap-4">
          <Link href="/shop" className="text-zinc-700 hover:text-brand-blue">
            Assortiment
          </Link>
          {data.user ? (
            <>
              <Link href="/dashboard" className="text-zinc-700 hover:text-brand-blue">
                Dashboard
              </Link>
              <form action="/logout" method="post" className="inline">
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  Uitloggen
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-zinc-700 hover:text-brand-blue">
              Inloggen
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
