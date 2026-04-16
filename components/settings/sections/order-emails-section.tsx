import { getSetting } from "@/lib/settings";
import type { SettingsSectionBase } from "@/lib/settings/settings-base";
import { saveOrderEmailTemplates } from "@/lib/settings/settings-server-actions";
import { SettingsBaseHidden } from "@/components/settings/SettingsBaseHidden";
import { getOrderEmailTemplatesOrDefaults } from "@/lib/email/order-email-templates";

const sample = {
  orderNumber: "EM-2026-000123",
  customerName: "Voorbeeldklant",
  orderUrl: "https://example.nl/checkout/bedankt?token=…",
  items: "<ul><li>Trainingspak × 1</li><li>Sokken × 2</li></ul>",
  itemsReady: "<ul><li>Trainingspak × 1</li></ul>",
  itemsBackorder: "<ul><li>Sokken × 2</li></ul>"
};

function applySample(html: string): string {
  return html
    .replaceAll("{orderNumber}", sample.orderNumber)
    .replaceAll("{customerName}", sample.customerName)
    .replaceAll("{orderUrl}", sample.orderUrl)
    .replaceAll("{items}", sample.items)
    .replaceAll("{itemsReady}", sample.itemsReady)
    .replaceAll("{itemsBackorder}", sample.itemsBackorder);
}

export async function OrderEmailsSettingsSection({
  base,
  ok,
  error
}: {
  base: SettingsSectionBase;
  ok: boolean;
  error: string;
}) {
  const existing = (await getSetting("order_emails")) as Partial<Record<string, unknown>>;
  const defaults = await getOrderEmailTemplatesOrDefaults();

  const v = {
    confirmationSubject: String(existing.confirmationSubject ?? defaults.confirmationSubject),
    confirmationHtml: String(existing.confirmationHtml ?? defaults.confirmationHtml),
    pickupCompleteSubject: String(existing.pickupCompleteSubject ?? defaults.pickupCompleteSubject),
    pickupCompleteHtml: String(existing.pickupCompleteHtml ?? defaults.pickupCompleteHtml),
    pickupIncompleteSubject: String(existing.pickupIncompleteSubject ?? defaults.pickupIncompleteSubject),
    pickupIncompleteHtml: String(existing.pickupIncompleteHtml ?? defaults.pickupIncompleteHtml)
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Order e-mails</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Templates voor: bevestiging, afhalen (compleet), afhalen (incompleet/backorder). Gebruik placeholders zoals{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs">{`{orderNumber}`}</code>,{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs">{`{customerName}`}</code>,{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs">{`{items}`}</code>,{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs">{`{itemsReady}`}</code>,{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs">{`{itemsBackorder}`}</code>,{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs">{`{orderUrl}`}</code>.
      </p>

      {ok ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Opgeslagen.</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form action={saveOrderEmailTemplates} className="mt-6 space-y-8">
        <SettingsBaseHidden value={base} />

        <TemplateBlock
          title="Bevestiging bestelling"
          subjectName="confirmationSubject"
          htmlName="confirmationHtml"
          subjectDefault={v.confirmationSubject}
          htmlDefault={v.confirmationHtml}
        />

        <TemplateBlock
          title="Afhalen complete bestelling"
          subjectName="pickupCompleteSubject"
          htmlName="pickupCompleteHtml"
          subjectDefault={v.pickupCompleteSubject}
          htmlDefault={v.pickupCompleteHtml}
        />

        <TemplateBlock
          title="Afhalen incomplete bestelling"
          subjectName="pickupIncompleteSubject"
          htmlName="pickupIncompleteHtml"
          subjectDefault={v.pickupIncompleteSubject}
          htmlDefault={v.pickupIncompleteHtml}
        />

        <div>
          <button className="rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white" type="submit">
            Opslaan
          </button>
        </div>
      </form>
    </div>
  );
}

function TemplateBlock({
  title,
  subjectName,
  htmlName,
  subjectDefault,
  htmlDefault
}: {
  title: string;
  subjectName: string;
  htmlName: string;
  subjectDefault: string;
  htmlDefault: string;
}) {
  const preview = applySample(htmlDefault);
  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>

      <label className="mt-4 block">
        <span className="text-sm text-zinc-700">Onderwerp</span>
        <input
          name={subjectName}
          defaultValue={subjectDefault}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm text-zinc-700">HTML</span>
        <textarea
          name={htmlName}
          defaultValue={htmlDefault}
          rows={10}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
        />
      </label>

      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Voorvertoning (met voorbeelddata)</div>
        <div className="prose prose-sm mt-3 max-w-none" dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
    </section>
  );
}

