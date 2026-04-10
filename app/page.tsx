import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-blue">Kledingshop</h1>
      <p className="mt-2 text-sm text-zinc-600">Basis staat klaar (Next.js + Tailwind + Supabase).</p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        {user ? (
          <form action="/logout" method="post">
            <Button variant="secondary" type="submit">
              Uitloggen
            </Button>
          </form>
        ) : (
          <Link href="/login">
            <Button variant="primary" type="button">
              Inloggen
            </Button>
          </Link>
        )}
        <Link href="/admin">
          <Button variant="secondary" type="button">
            Admin
          </Button>
        </Link>
      </div>
    </main>
  );
}

