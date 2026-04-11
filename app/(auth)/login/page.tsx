import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signInWithPassword(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  redirect("/");
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const error = typeof sp.error === "string" ? sp.error : "";

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold">Inloggen kledingcommissie</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Dit account is alleen bedoeld voor medewerkers van de kledingcommissie (beheer van de shop). Leden, supporters
        en staf bestellen zonder in te loggen.
      </p>

      {error ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form action={signInWithPassword} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-sm text-zinc-700">E-mail</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm text-zinc-700">Wachtwoord</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          Inloggen
        </button>
      </form>
    </main>
  );
}

