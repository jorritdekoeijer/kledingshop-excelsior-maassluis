"use server";

import { redirect } from "next/navigation";
import { createStockDeliveryAction, updateStockDeliveryAction } from "@/app/dashboard/stock/levering/actions";

export async function submitStockDeliveryFormAction(formData: FormData) {
  const raw = String(formData.get("payloadJson") ?? "").trim();
  if (!raw) redirect("/dashboard/stock/levering/nieuw?error=Ontbrekende%20payload");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    redirect("/dashboard/stock/levering/nieuw?error=Ongeldige%20payload%20(JSON)");
  }

  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  if (deliveryId) {
    await updateStockDeliveryAction(deliveryId, payload);
    return;
  }

  await createStockDeliveryAction(payload);
}

