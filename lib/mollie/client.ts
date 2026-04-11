const MOLLIE_API = "https://api.mollie.com/v2";

export type MolliePaymentJson = {
  id: string;
  status: string;
  amount?: { currency?: string; value?: string };
  metadata?: Record<string, string | undefined>;
  _links?: { checkout?: { href?: string } };
};

export async function mollieCreatePayment(apiKey: string, body: Record<string, unknown>): Promise<MolliePaymentJson> {
  const res = await fetch(`${MOLLIE_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Mollie create payment ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as MolliePaymentJson;
}

export async function mollieGetPayment(apiKey: string, paymentId: string): Promise<MolliePaymentJson> {
  const res = await fetch(`${MOLLIE_API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Mollie get payment ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as MolliePaymentJson;
}
