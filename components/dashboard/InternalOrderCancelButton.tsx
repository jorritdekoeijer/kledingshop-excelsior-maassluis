"use client";

import { useState, useTransition } from "react";
import { cancelInternalOrderAction } from "@/app/dashboard/stock/interne-bestelling/actions";

export function InternalOrderCancelButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function onCancel() {
    if (!confirm("Weet je zeker dat je deze interne bestelling wilt annuleren en de voorraad wilt terugboeken?")) return;
    startTransition(() => {
      cancelInternalOrderAction({ id, cancelNote: note });
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        Annuleren
      </button>

      {open ? (
        <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-zinc-900">Annuleren (voorraad terugboeken)</p>
          <p className="mt-1 text-xs text-zinc-600">
            Dit zet de voorraad terug en markeert de interne bestelling als geannuleerd (telt niet meer mee in rapportage).
          </p>
          <label className="mt-3 block text-sm">
            <span className="text-zinc-600">Reden (optioneel)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Sluiten
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onCancel}
              className="rounded-lg bg-brand-red px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Annuleren…" : "Annuleer en boek terug"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

