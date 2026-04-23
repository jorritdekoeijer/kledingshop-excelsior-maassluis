"use client";

import { useTransition } from "react";
import { restoreInternalOrderStockAction } from "@/app/dashboard/stock/interne-bestelling/actions";

export function InternalOrderRestoreStockButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function onRestore() {
    if (!confirm("Voorraad herstellen voor deze interne bestelling? Dit kan maar één keer.")) return;
    startTransition(() => {
      restoreInternalOrderStockAction({ id });
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onRestore}
      className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
    >
      {pending ? "Herstellen…" : "Voorraad herstellen"}
    </button>
  );
}

