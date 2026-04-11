import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifieert `X-Mollie-Signature` (HMAC-SHA256 hex) tegen de ruwe body.
 * Zie: https://docs.mollie.com/reference/webhooks-best-practices
 * Als er geen header is (klassieke Payment-webhook met alleen `id=`), sla je deze stap over.
 */
export function verifyMollieWebhookSignature(rawBody: string, headerSignature: string | null, secret: string): boolean {
  if (!headerSignature || !secret) return false;
  const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const sig = headerSignature.trim();
  if (!/^[0-9a-fA-F]+$/.test(sig) || sig.length % 2 !== 0) return false;
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseMollieWebhookPaymentId(rawBody: string): string | null {
  const trimmed = rawBody.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as { id?: string };
      return typeof j.id === "string" ? j.id : null;
    } catch {
      return null;
    }
  }
  return new URLSearchParams(trimmed).get("id");
}
