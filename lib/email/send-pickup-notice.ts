import nodemailer from "nodemailer";
import { getSettingService } from "@/lib/settings-service";
import { smtpSettingsSchema } from "@/lib/validation/settings";
import { itemsToHtmlList, renderOrderEmail } from "@/lib/email/order-email-templates";

export type PickupNoticePayload = {
  guestEmail: string;
  guestName: string | null;
  orderNumber: string;
  publicToken: string;
  ready: Array<{ name: string; quantity: number }>;
  backorder: Array<{ name: string; quantity: number }>;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function sendPickupNoticeEmail(p: PickupNoticePayload): Promise<{ ok: boolean; kind: "complete" | "incomplete" }>{
  const raw = await getSettingService("smtp");
  const parsed = smtpSettingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, kind: p.backorder.length > 0 ? "incomplete" : "complete" };

  const kind = p.backorder.length > 0 ? "incomplete" : "complete";
  const key = kind === "complete" ? "pickup_complete" : "pickup_incomplete";
  const name = p.guestName?.trim() || "klant";

  const rendered = await renderOrderEmail(key, {
    orderNumber: p.orderNumber,
    publicToken: p.publicToken,
    customerName: name,
    itemsAllHtml: itemsToHtmlList([...p.ready, ...p.backorder]),
    itemsReadyHtml: itemsToHtmlList(p.ready),
    itemsBackorderHtml: itemsToHtmlList(p.backorder)
  });
  if (!rendered) return { ok: false, kind };

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
      subject: rendered.subject,
      text: stripTags(rendered.html),
      html: rendered.html
    });
    return { ok: true, kind };
  } catch {
    return { ok: false, kind };
  }
}

