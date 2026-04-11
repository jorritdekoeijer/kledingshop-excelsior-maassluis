import Link from "next/link";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

type BedanktOrder = {
  status: string;
  total_cents: number;
  guest_name: string | null;
  fulfillment_error: string | null;
  order_items: {
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    products: { name: string } | null;
  }[];
};

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

export default async function BedanktPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const token = typeof sp.token === "string" ? sp.token : "";

  let order: BedanktOrder | null = null;

  if (token) {
    const svc = createSupabaseServiceClient();
    const { data } = await svc
      .from("orders")
      .select(
        "status,total_cents,guest_name,fulfillment_error,order_items(quantity,unit_price_cents,line_total_cents,products(name))"
      )
      .eq("public_token", token)
      .maybeSingle();
    order = data as BedanktOrder | null;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
        {!token ? (
          <p className="text-sm text-zinc-600">Geen order gevonden. Controleer je link.</p>
        ) : !order ? (
          <p className="text-sm text-zinc-600">We konden deze bestelling niet vinden.</p>
        ) : (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold text-brand-blue">Bedankt{order.guest_name ? `, ${order.guest_name}` : ""}!</h1>
            {order.status === "paid" ? (
              <p className="text-sm text-zinc-700">
                Je betaling is ontvangen. De kledingcommissie verwerkt je bestelling zo snel mogelijk.
              </p>
            ) : order.status === "pending_payment" ? (
              <p className="text-sm text-amber-900">
                Je betaling wordt nog verwerkt. Vernieuw deze pagina over een paar minuten als de status niet klopt.
              </p>
            ) : (
              <p className="text-sm text-zinc-700">Status: {order.status}</p>
            )}

            {order.fulfillment_error ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Er was een probleem bij het verwerken van de voorraad. Je betaling staat geregistreerd — de commissie
                neemt zo nodig contact met je op. ({order.fulfillment_error.slice(0, 200)}
                {order.fulfillment_error.length > 200 ? "…" : ""})
              </p>
            ) : null}

            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-sm font-medium text-zinc-900">Overzicht</p>
              <ul className="mt-3 space-y-2 text-sm">
                {(order.order_items ?? []).map((li, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span>
                      {li.products?.name ?? "Product"} × {li.quantity}
                    </span>
                    <span>{eur(li.line_total_cents)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex justify-between border-t border-zinc-100 pt-3 text-base font-semibold">
                <span>Totaal</span>
                <span>{eur(order.total_cents)}</span>
              </p>
            </div>

            <Link href="/shop" className="inline-block text-sm font-medium text-brand-blue hover:underline">
              Terug naar de shop
            </Link>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
