import nodemailer from "nodemailer";
import { getSiteUrl } from "@/lib/checkout/site-url";
import { getSettingService } from "@/lib/settings-service";
import { smtpSettingsSchema } from "@/lib/validation/settings";
import { renderOrderEmail } from "@/lib/email/order-email-templates";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type OrderConfirmationPayload = {
  guestEmail: string;
  guestName: string | null;
  publicToken: string;
  totalCents: number;
  fulfillmentError: string | null;
  orderNumber?: string | null;
  itemsHtml?: string;
  /** Handmatig opnieuw verstuurd vanuit het dashboard. */
  isResend?: boolean;
};

/**
 * Stuurt max. één keer per aanroep (caller zet `confirmation_sent_at`).
 * Retourneert false als SMTP niet geconfigureerd is of verzenden faalt.
 */
export async function sendOrderConfirmationEmail(p: OrderConfirmationPayload): Promise<boolean> {
  const raw = await getSettingService("smtp");
  const parsed = smtpSettingsSchema.safeParse(raw);
  if (!parsed.success) return false;

  const site = getSiteUrl();
  const thankUrl = `${site}/checkout/bedankt?token=${encodeURIComponent(p.publicToken)}`;
  const total = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p.totalCents / 100);
  const name = p.guestName?.trim() || "klant";
  const orderNumber = (p.orderNumber ?? "").trim() || "—";

  const stockProblem = Boolean(p.fulfillmentError && p.fulfillmentError.length > 0);
  const rendered = await renderOrderEmail("confirmation", {
    orderNumber,
    publicToken: p.publicToken,
    customerName: name,
    itemsAllHtml: p.itemsHtml ?? `<p>Totaal: <strong>${esc(total)}</strong></p>`,
    itemsReadyHtml: p.itemsHtml ?? "",
    itemsBackorderHtml: ""
  });
  if (!rendered) return false;
  const subject = `${p.isResend ? "[Herzending] " : ""}${rendered.subject}`;

  const resendNote = p.isResend ? ["(Dit is een herzending van je bevestiging.)", ""] : [];

  const textLines = stockProblem
    ? [
        `Beste ${name},`,
        "",
        ...resendNote,
        "We hebben je betaling ontvangen (" + total + ").",
        "Er was een technisch probleem bij het direct verwerken van de voorraad. De kledingcommissie neemt zo nodig contact met je op.",
        "",
        `Je kunt je bestelling ook hier bekijken: ${thankUrl}`,
        "",
        "Met vriendelijke groet,",
        "Kledingcommissie Excelsior Maassluis"
      ]
    : [
        `Beste ${name},`,
        "",
        ...resendNote,
        "Bedankt voor je bestelling bij Excelsior Maassluis.",
        `Totaal: ${total}.`,
        "",
        `Link naar je overzicht: ${thankUrl}`,
        "",
        "Met vriendelijke groet,",
        "Kledingcommissie Excelsior Maassluis"
      ];

  const resendHtml = p.isResend ? `<p><em>Dit is een herzending van je bevestiging.</em></p>` : "";
  const html = `${resendHtml}${rendered.html}${
    stockProblem
      ? `<p><em>Let op: er was een technisch probleem bij het verwerken van de voorraad. De kledingcommissie pakt dit op.</em></p>`
      : ""
  }`;

  try {
    const t = nodemailer.createTransport({
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      auth: { user: parsed.data.user, pass: parsed.data.pass }
    });
    await t.sendMail({
      from: parsed.data.from,
      to: p.guestEmail,
      subject,
      text: textLines.join("\n"),
      html
    });
    return true;
  } catch {
    return false;
  }
}
