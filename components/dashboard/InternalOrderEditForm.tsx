"use client";

import { useState, useTransition } from "react";
import { updateInternalOrderMetaAction } from "@/app/dashboard/stock/interne-bestelling/actions";

type CostGroup = { id: string; name: string };

export function InternalOrderEditForm({
  defaults,
  costGroups
}: {
  defaults: { id: string; orderDate: string; costGroupId: string; note: string };
  costGroups: CostGroup[];
}) {
  const [orderDate, setOrderDate] = useState(defaults.orderDate);
  const [costGroupId, setCostGroupId] = useState(defaults.costGroupId);
  const [note, setNote] = useState(defaults.note);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      updateInternalOrderMetaAction({
        id: defaults.id,
        orderDate,
        costGroupId,
        note
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="text-zinc-600">Datum</span>
        <input
          type="date"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </label>

      <label className="block text-sm">
        <span className="text-zinc-600">Kostengroep</span>
        <select
          value={costGroupId}
          onChange={(e) => setCostGroupId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          required
        >
          <option value="" disabled>
            Kies kostengroep…
          </option>
          {costGroups.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-zinc-600">Omschrijving</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          rows={5}
          required
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Opslaan…" : "Opslaan"}
      </button>
    </form>
  );
}

