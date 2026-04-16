import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission, permissions } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/permissions-server";
import { markOrderPickedUp, markOrderReadyForPickup, pickOrderItem, resendOrderConfirmationEmail } from "@/app/dashboard/orders/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const eur = (cents: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

const statusNl: Record<string, string> = {
  created: "Aangemaakt",
  pending_payment: "Wacht op betaling",
  paid: "Betaald",
  cancelled: "Geannuleerd",
  fulfilled: "Afgehandeld",
  new_order: "Nieuwe bestelling",
  ready_for_pickup: "Klaar om af te halen",
  backorder: "Backorder",
  completed: "Afgerond"
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardOrderDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const sp = (await searchParams) ?? {};
  const flashFulfilled = sp.ok === "fulfilled" || sp.ok === "1";
  const flashMail = sp.mail === "sent";
  const flashError = typeof sp.error === "string" ? sp.error : "";

  const gate = await requirePermission(permissions.orders.read);
  if (!gate.ok) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Geen toegang</h1>
        <p className="mt-2 text-sm text-zinc-600">Je hebt geen permissie om deze order te bekijken.</p>
      </div>
    );
  }

  const canWrite =
    gate.isAdmin ||
    hasPermission(gate.permissions, permissions.orders.write) ||
    hasPermission(gate.permissions, permissions.dashboard.access);

  const supabase = await createSupabaseServerClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id,status,total_cents,guest_email,guest_name,guest_phone,shipping_address,fulfillment_error,confirmation_sent_at,public_token,created_at,updated_at,order_number,pickup_email_sent_at,pickup_email_kind,order_items(id,quantity,unit_price_cents,line_total_cents,picked,delivered,products(name,slug)),mollie_payments(mollie_payment_id,status,created_at,updated_at)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !order) notFound();

  const items = (order.order_items ?? []) as unknown as Array<{
    id: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    picked?: boolean;
    delivered?: boolean;
    products?: unknown;
  }>;

  const payments = (order.mollie_payments ?? []) as unknown as Array<{
    mollie_payment_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;

  const addr = order.shipping_address as Record<string, string> | null;
  const detailPath = `/dashboard/orders/${order.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/orders" className="text-sm text-brand-blue hover:underline">
            ← Te maken bestellingen
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-brand-blue">
            Bestelling {String((order as any).order_number ?? "").trim() || `${order.id.slice(0, 8)}…`}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Aangemaakt{" "}
            {order.created_at
              ? new Date(order.created_at).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })
              : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/checkout/bedankt?token=${order.public_token}`}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
            target="_blank"
            rel="noreferrer"
          >
            Publieke bedankt-pagina
          </Link>
        </div>
      </div>

      {flashFulfilled ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Order gemarkeerd als afgehandeld.
        </p>
      ) : null}
      {flashMail ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Bevestigingsmail opnieuw verstuurd.
        </p>
      ) : null}
      {flashError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{flashError}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold text-zinc-900">Status</h2>
          <p className="mt-2 text-sm">
            <span className="font-medium">{statusNl[order.status] ?? order.status}</span>
            {order.fulfillment_error ? (
              <span className="mt-2 block rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
                Voorraad: {order.fulfillment_error}
              </span>
            ) : null}
          </p>
          <p className="mt-3 text-sm text-zinc-600">
            Bevestigingsmail:{" "}
            {order.confirmation_sent_at
              ? new Date(order.confirmation_sent_at).toLocaleString("nl-NL", {
                  dateStyle: "medium",
                  timeStyle: "short"
                })
              : "nog niet verstuurd"}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Afhaalmail:{" "}
            {(order as any).pickup_email_sent_at
              ? `${new Date((order as any).pickup_email_sent_at).toLocaleString("nl-NL", {
                  dateStyle: "medium",
                  timeStyle: "short"
                })} (${String((order as any).pickup_email_kind ?? "")})`
              : "nog niet verstuurd"}
          </p>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold text-zinc-900">Klant</h2>
          <dl className="mt-3 space-y-1 text-sm">
            <div>
              <dt className="text-zinc-500">Naam</dt>
              <dd>{order.guest_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">E-mail</dt>
              <dd>
                <a className="text-brand-blue hover:underline" href={`mailto:${order.guest_email ?? ""}`}>
                  {order.guest_email ?? "—"}
                </a>
              </dd>
            </div>
            {order.guest_phone ? (
              <div>
                <dt className="text-zinc-500">Telefoon</dt>
                <dd>{order.guest_phone}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold text-zinc-900">Afleveradres</h2>
        {addr && (addr.line1 || addr.postalCode || addr.city) ? (
          <address className="mt-3 text-sm not-italic text-zinc-800">
            {addr.line1 ? <div>{addr.line1}</div> : null}
            {addr.line2 ? <div>{addr.line2}</div> : null}
            <div>
              {addr.postalCode ?? ""} {addr.city ?? ""}
            </div>
            {addr.country ? <div>{addr.country}</div> : null}
          </address>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Geen adres opgeslagen.</p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold text-zinc-900">Regels</h2>
        <ul className="mt-3 divide-y divide-zinc-100">
          {items.map((li, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">
                  {lineProductName(li)}{" "}
                  <span className="text-zinc-500">
                    × {li.quantity} à {eur(li.unit_price_cents)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 ${li.delivered ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-700"}`}>
                    {li.delivered ? "AFGELEVERD" : li.picked ? "INGEPAKT" : "OPEN"}
                  </span>
                  {!li.delivered && !li.picked && canWrite && (order.status === "new_order" || order.status === "backorder") ? (
                    <form action={pickOrderItem}>
                      <input type="hidden" name="orderItemId" value={li.id} />
                      <input type="hidden" name="next" value={detailPath} />
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                      >
                        In voorraad (aanklikken)
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
              <span className="font-medium">{eur(li.line_total_cents)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between border-t border-zinc-200 pt-3 text-base font-semibold">
          <span>Totaal</span>
          <span>{eur(order.total_cents)}</span>
        </p>
      </section>

      {payments.length > 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold text-zinc-900">Mollie</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {payments.map((p) => (
              <li key={p.mollie_payment_id} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div className="font-mono text-xs">{p.mollie_payment_id}</div>
                <div className="mt-1">
                  Status: <span className="font-medium">{p.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canWrite ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold text-zinc-900">Acties</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {(order.status === "new_order" || order.status === "backorder") ? (
              <form action={markOrderReadyForPickup}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="next" value={detailPath} />
                <button
                  type="submit"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Bestelling klaar voor afhalen
                </button>
              </form>
            ) : null}

            {order.status === "ready_for_pickup" ? (
              <form action={markOrderPickedUp}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="next" value={detailPath} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                >
                  AFGEHAALD
                </button>
              </form>
            ) : null}

            {order.status === "new_order" || order.status === "ready_for_pickup" || order.status === "backorder" ? (
              <form action={resendOrderConfirmationEmail}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="next" value={detailPath} />
                <button
                  type="submit"
                  className="rounded-md border border-brand-blue/40 bg-brand-blue/5 px-4 py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue/10"
                >
                  Stuur bevestigingsmail opnieuw
                </button>
              </form>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Opnieuw versturen werkt alleen als SMTP onder Instellingen → E-mail staat ingevuld.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function lineProductName(li: { products?: unknown }): string {
  const p = li.products;
  if (Array.isArray(p)) {
    const first = p[0];
    if (first && typeof first === "object" && first !== null && "name" in first) {
      return String((first as { name?: string }).name ?? "Product");
    }
    return "Product";
  }
  if (p && typeof p === "object" && p !== null && "name" in p) {
    return String((p as { name?: string }).name ?? "Product");
  }
  return "Product";
}
