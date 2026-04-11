"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useCart } from "@/components/shop/cart/CartContext";

export function CheckoutForm() {
  const router = useRouter();
  const { lines, ready, totalQuantity, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0 || totalQuantity === 0) {
      router.replace("/cart");
    }
  }, [ready, lines.length, totalQuantity, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const items = lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));
    const body = {
      items,
      guestEmail: String(fd.get("guestEmail") ?? "").trim(),
      guestName: String(fd.get("guestName") ?? "").trim(),
      guestPhone: String(fd.get("guestPhone") ?? "").trim(),
      shippingAddress: {
        line1: String(fd.get("line1") ?? "").trim(),
        line2: String(fd.get("line2") ?? "").trim() || undefined,
        postalCode: String(fd.get("postalCode") ?? "").trim(),
        city: String(fd.get("city") ?? "").trim(),
        country: String(fd.get("country") ?? "NL").trim().toUpperCase() || "NL"
      }
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = (await res.json()) as { checkoutUrl?: string; error?: string; publicToken?: string };
      if (!res.ok) {
        setError(json.error ?? "Er ging iets mis.");
        setSubmitting(false);
        return;
      }
      if (json.checkoutUrl) {
        clear();
        window.location.href = json.checkoutUrl;
        return;
      }
      setError("Geen betaallink ontvangen.");
    } catch {
      setError("Netwerkfout. Probeer het opnieuw.");
    }
    setSubmitting(false);
  }

  if (!ready) {
    return <p className="text-sm text-zinc-500">Laden…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">E-mail</span>
            <input
              name="guestEmail"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">Naam</span>
            <input
              name="guestName"
              required
              autoComplete="name"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">Telefoon (optioneel)</span>
            <input
              name="guestPhone"
              type="tel"
              autoComplete="tel"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Afleveradres</h2>
        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="text-sm text-zinc-700">Straat en huisnummer</span>
            <input name="line1" required autoComplete="street-address" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-700">Toevoeging (optioneel)</span>
            <input name="line2" autoComplete="address-line2" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-zinc-700">Postcode</span>
              <input name="postalCode" required autoComplete="postal-code" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-700">Plaats</span>
              <input name="city" required autoComplete="address-level2" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm text-zinc-700">Land</span>
            <select name="country" defaultValue="NL" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="NL">Nederland</option>
              <option value="BE">België</option>
            </select>
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[44px] items-center justify-center rounded-none bg-brand-blue px-6 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? "Bezig…" : "Verder naar betaling (Mollie)"}
        </button>
        <Link href="/cart" className="text-sm text-brand-blue hover:underline">
          Terug naar winkelmand
        </Link>
      </div>
    </form>
  );
}
