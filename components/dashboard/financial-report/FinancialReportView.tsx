import Link from "next/link";
import { centsToEuroString } from "@/lib/money/nl-euro";
import type { FinancialOverviewReport } from "@/lib/reports/financial-overview";

function eurExcl(cents: number): string {
  return `€ ${centsToEuroString(cents)}`;
}

function BarRow({
  label,
  valueCents,
  maxCents,
  accentClass
}: {
  label: string;
  valueCents: number;
  maxCents: number;
  accentClass: string;
}) {
  const pct = maxCents > 0 ? Math.min(100, Math.round((valueCents / maxCents) * 1000) / 10) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-sm">
        <span className="truncate text-zinc-700">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-zinc-900">{eurExcl(valueCents)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${accentClass}`}
          style={{ width: `${pct}%` }}
          role="presentation"
        />
      </div>
    </div>
  );
}

export function FinancialReportView({ report }: { report: FinancialOverviewReport }) {
  const { costGroups, webshop, inventory, period } = report;
  const cgMax = Math.max(0, ...costGroups.map((c) => c.totalPurchaseExclCents));

  const rev = webshop.revenueExclCents;
  const cogs = webshop.cogsExclCents;
  const stackTotal = rev + cogs > 0 ? rev + cogs : 1;
  const revBarPct = Math.round((rev / stackTotal) * 1000) / 10;
  const cogsBarPct = Math.round((cogs / stackTotal) * 1000) / 10;

  return (
    <div className="space-y-10">
      <form
        className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        method="get"
      >
        <label className="block text-sm">
          <span className="text-zinc-600">Van</span>
          <input
            type="date"
            name="from"
            defaultValue={period.fromDate}
            className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600">Tot en met</span>
          <input
            type="date"
            name="to"
            defaultValue={period.toDate}
            className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Periode toepassen
        </button>
        <p className="w-full text-xs text-zinc-500">
          Standaard: dit kalenderjaar t/m vandaag. Webshop gebruikt betaalde orders in de periode; inkoop kosten volgt FIFO
          op het moment van betaling. Voorraad is een momentopname (nu).
        </p>
      </form>

      {report.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Let op</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/90">
            {report.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* KPI-raster */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue to-[#0a3d7a] p-5 text-white shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">Webshop omzet (excl. btw)</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{eurExcl(webshop.revenueExclCents)}</p>
          <p className="mt-1 text-xs text-white/75">{webshop.orderCount} betaalde orders</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 p-5 text-white shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">Inkoop verkopen (FIFO)</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{eurExcl(webshop.cogsExclCents)}</p>
          <p className="mt-1 text-xs text-white/75">T.o.v. omzet excl. btw</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 text-white shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">Bruto marge / resultaat</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{eurExcl(webshop.grossMarginExclCents)}</p>
          <p className="mt-1 text-xs text-white/75">
            {webshop.marginPercent != null ? `${webshop.marginPercent}% van omzet excl.` : "—"}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 p-5 text-white shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-white/80">Voorraadwaarde (inkoop)</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{eurExcl(inventory.valueExclCents)}</p>
          <p className="mt-1 text-xs text-white/75">
            {inventory.linesWithStock} batch-regels ·{" "}
            {inventory.batchesMissingPurchasePrice > 0 ? (
              <span className="text-amber-100">
                {inventory.batchesMissingPurchasePrice} zonder inkoopprijs
              </span>
            ) : (
              "alle batches gewaardeerd"
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Webshop verdeling */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-blue">Webshop: omzet vs. inkoop</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Omzet is getotaliseerd <strong>excl. btw</strong> (21% verwijderd uit de verkoopprijs incl. btw). Inkoop is de
            som van FIFO-afboekingen met reden <code className="rounded bg-zinc-100 px-1 text-xs">sale</code> in deze
            periode.
          </p>

          <div className="mt-6 space-y-4">
            <div className="flex h-10 overflow-hidden rounded-lg">
              <div
                className="flex items-center justify-center bg-brand-blue/90 text-xs font-medium text-white"
                style={{ width: `${revBarPct}%` }}
                title={`Omzet excl. ${eurExcl(rev)}`}
              >
                {revBarPct > 12 ? "Omzet" : ""}
              </div>
              <div
                className="flex items-center justify-center bg-zinc-400 text-xs font-medium text-white"
                style={{ width: `${cogsBarPct}%` }}
                title={`Inkoop ${eurExcl(cogs)}`}
              >
                {cogsBarPct > 12 ? "Inkoop" : ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-4 rounded bg-brand-blue/90" /> Omzet excl. btw
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-4 rounded bg-zinc-400" /> Inkoop (FIFO)
              </span>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 border-t border-zinc-100 pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Omzet incl. btw (ter referentie)</dt>
              <dd className="font-medium tabular-nums text-zinc-900">
                € {centsToEuroString(webshop.revenueInclCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Omzet excl. btw</dt>
              <dd className="font-medium tabular-nums text-zinc-900">{eurExcl(webshop.revenueExclCents)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Inkoop verkochte voorraad</dt>
              <dd className="font-medium tabular-nums text-zinc-900">{eurExcl(webshop.cogsExclCents)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-dashed border-zinc-200 pt-3">
              <dt className="font-medium text-zinc-800">Bruto marge (excl. btw)</dt>
              <dd className="font-semibold tabular-nums text-emerald-800">{eurExcl(webshop.grossMarginExclCents)}</dd>
            </div>
          </dl>
        </section>

        {/* Kostengroepen */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-blue">Interne afboekingen per kostengroep</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Totalen zijn <strong>excl. btw</strong>, gebaseerd op interne bestellingen met orderdatum in de gekozen periode.
          </p>
          <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            Mist je database de tabel <span className="font-mono">internal_orders</span>? Draai dan eerst migratie{" "}
            <span className="font-mono">0017_internal_orders.sql</span>. Zonder die migratie blijft dit blok op 0 staan.
          </p>
          <p className="mt-3 text-sm font-medium text-zinc-800">
            Totaal intern: <span className="tabular-nums text-brand-red">{eurExcl(report.internalOrdersTotalExclCents)}</span>
          </p>

          <div className="mt-6 space-y-4">
            {costGroups.length === 0 ? (
              <p className="text-sm text-zinc-500">Geen kostengroepen gedefinieerd.</p>
            ) : (
              costGroups.map((c) => (
                <BarRow
                  key={c.id}
                  label={c.name}
                  valueCents={c.totalPurchaseExclCents}
                  maxCents={cgMax || 1}
                  accentClass="bg-gradient-to-r from-brand-red/90 to-brand-red"
                />
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-blue">Voorraadwaarde</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Huidige voorraad gewaardeerd tegen <strong>inkoopprijs excl. btw</strong> per batch (
          <code className="rounded bg-zinc-100 px-1 text-xs">
            quantity_remaining × (unit_purchase_excl_cents + unit_printing_excl_cents)
          </code>
          ). Dit is geen verkoopwaarde.
        </p>
        <p className="mt-4 text-3xl font-bold tabular-nums text-brand-blue">{eurExcl(inventory.valueExclCents)}</p>
        {inventory.batchesMissingPurchasePrice > 0 ? (
          <p className="mt-2 text-sm text-amber-800">
            Let op: {inventory.batchesMissingPurchasePrice} batch(s) met voorraad hebben geen inkoopprijs en tellen niet
            mee in deze waarde. Vul inkoopprijzen bij leveringen/voorraad.
          </p>
        ) : null}
      </section>

      <p className="text-center text-xs text-zinc-500">
        <Link href="/dashboard" className="text-brand-blue hover:underline">
          Terug naar beheer
        </Link>
      </p>
    </div>
  );
}
