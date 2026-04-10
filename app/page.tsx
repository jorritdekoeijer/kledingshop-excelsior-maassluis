import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Kledingshop</h1>
      <p className="mt-2 text-sm text-zinc-600">Projectstructuur staat klaar (Next.js + Tailwind).</p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        {user ? (
          <form action="/logout" method="post">
            <button className="rounded-md border border-zinc-300 px-3 py-2">Uitloggen</button>
          </form>
        ) : (
          <Link className="rounded-md border border-zinc-300 px-3 py-2" href="/login">
            Inloggen
          </Link>
        )}
        <Link className="rounded-md border border-zinc-300 px-3 py-2" href="/admin">
          Admin
        </Link>
      </div>
    </main>
  );
}

