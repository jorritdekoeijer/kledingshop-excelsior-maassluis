import { getSiteUrl } from "@/lib/checkout/site-url";
import { getSettingService } from "@/lib/settings-service";
import { orderEmailTemplatesSchema } from "@/lib/validation/settings";

export type OrderEmailTemplateKey = "confirmation" | "pickup_complete" | "pickup_incomplete";

export type OrderEmailRenderInput = {
  orderNumber: string;
  publicToken: string;
  customerName: string;
  itemsAllHtml: string;
  itemsReadyHtml: string;
  itemsBackorderHtml: string;
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function itemsToHtmlList(lines: Array<{ name: string; quantity: number }>): string {
  if (lines.length === 0) return "<p>—</p>";
  return `<ul>${lines.map((l) => `<li>${esc(l.name)} × ${l.quantity}</li>`).join("")}</ul>`;
}

function applyPlaceholders(htmlOrSubject: string, vars: OrderEmailRenderInput): string {
  const site = getSiteUrl();
  const orderUrl = `${site}/checkout/bedankt?token=${encodeURIComponent(vars.publicToken)}`;
  return htmlOrSubject
    .replaceAll("{orderNumber}", vars.orderNumber)
    .replaceAll("{customerName}", vars.customerName)
    .replaceAll("{orderUrl}", orderUrl)
    .replaceAll("{items}", vars.itemsAllHtml)
    .replaceAll("{itemsReady}", vars.itemsReadyHtml)
    .replaceAll("{itemsBackorder}", vars.itemsBackorderHtml);
}

export async function getOrderEmailTemplatesOrDefaults() {
  const raw = await getSettingService("order_emails");
  const parsed = orderEmailTemplatesSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  return {
    confirmationSubject: "Bevestiging bestelling {orderNumber} — Excelsior Maassluis",
    confirmationHtml: `<p>Beste {customerName},</p>
<p>Bedankt voor je bestelling. Je bestelnummer is <strong>{orderNumber}</strong>.</p>
<p>Producten:</p>
{items}
<p>Je kunt je bestelling bekijken via: <a href="{orderUrl}">{orderUrl}</a></p>
<p>Met vriendelijke groet,<br/>Kledingcommissie Excelsior Maassluis</p>`,
    pickupCompleteSubject: "Bestelling {orderNumber} klaar om af te halen",
    pickupCompleteHtml: `<p>Beste {customerName},</p>
<p>Je bestelling <strong>{orderNumber}</strong> ligt klaar om af te halen.</p>
<p>Producten:</p>
{itemsReady}
<p>Met vriendelijke groet,<br/>Kledingcommissie Excelsior Maassluis</p>`,
    pickupIncompleteSubject: "Bestelling {orderNumber} deels klaar om af te halen",
    pickupIncompleteHtml: `<p>Beste {customerName},</p>
<p>Je bestelling <strong>{orderNumber}</strong> is deels klaar om af te halen.</p>
<p>Klaar om af te halen:</p>
{itemsReady}
<p>Backorder (komt later):</p>
{itemsBackorder}
<p>Met vriendelijke groet,<br/>Kledingcommissie Excelsior Maassluis</p>`
  };
}

export async function renderOrderEmail(
  key: OrderEmailTemplateKey,
  vars: OrderEmailRenderInput
): Promise<{ subject: string; html: string } | null> {
  const t = await getOrderEmailTemplatesOrDefaults();
  const subjectRaw =
    key === "confirmation"
      ? t.confirmationSubject
      : key === "pickup_complete"
        ? t.pickupCompleteSubject
        : t.pickupIncompleteSubject;
  const htmlRaw =
    key === "confirmation"
      ? t.confirmationHtml
      : key === "pickup_complete"
        ? t.pickupCompleteHtml
        : t.pickupIncompleteHtml;

  return {
    subject: applyPlaceholders(subjectRaw, vars),
    html: applyPlaceholders(htmlRaw, vars)
  };
}

