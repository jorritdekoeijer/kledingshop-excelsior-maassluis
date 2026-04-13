import nodemailer from "nodemailer";
import { getSettingService } from "@/lib/settings-service";
import { smtpSettingsSchema } from "@/lib/validation/settings";

export type SupplierOrderEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export async function sendSupplierOrderEmail(params: {
  to: string;
  supplierName: string;
  subject: string;
  text: string;
  html: string;
  attachment: SupplierOrderEmailAttachment;
}): Promise<boolean> {
  const raw = await getSettingService("smtp");
  const parsed = smtpSettingsSchema.safeParse(raw);
  if (!parsed.success) return false;

  try {
    const t = nodemailer.createTransport({
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      auth: { user: parsed.data.user, pass: parsed.data.pass }
    });

    await t.sendMail({
      from: parsed.data.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: [
        {
          filename: params.attachment.filename,
          content: params.attachment.content,
          contentType: params.attachment.contentType
        }
      ]
    });

    return true;
  } catch {
    return false;
  }
}

