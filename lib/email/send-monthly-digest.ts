import nodemailer from "nodemailer";
import { getSettingService } from "@/lib/settings-service";
import { smtpSettingsSchema } from "@/lib/validation/settings";

export async function sendMonthlyDigestEmail(opts: {
  to: string;
  reportLabel: string;
  orderCount: number;
  revenueCents: number;
}): Promise<boolean> {
  const raw = await getSettingService("smtp");
  const parsed = smtpSettingsSchema.safeParse(raw);
  if (!parsed.success) return false;

  const total = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
    opts.revenueCents / 100
  );

  const subject = `Maandelijks overzicht kledingshop — ${opts.reportLabel}`;
  const text = [
    `Hier is het maandelijkse overzicht voor ${opts.reportLabel} (orders aangemaakt in die periode, status betaald of afgehandeld).`,
    "",
    `Aantal orders: ${opts.orderCount}`,
    `Omzet (totalen orders): ${total}`,
    "",
    "Met vriendelijke groet,",
    "Excelsior Maassluis (automatisch)"
  ].join("\n");

  const html = `<p>Hier is het maandelijkse overzicht voor <strong>${escapeHtml(opts.reportLabel)}</strong> (orders aangemaakt in die periode; status betaald of afgehandeld).</p>
<ul>
<li>Aantal orders: <strong>${opts.orderCount}</strong></li>
<li>Omzet (totalen orders): <strong>${escapeHtml(total)}</strong></li>
</ul>
<p style="color:#666;font-size:12px">Excelsior Maassluis — automatische mail</p>`;

  try {
    const t = nodemailer.createTransport({
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      auth: { user: parsed.data.user, pass: parsed.data.pass }
    });
    await t.sendMail({
      from: parsed.data.from,
      to: opts.to,
      subject,
      text,
      html
    });
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
