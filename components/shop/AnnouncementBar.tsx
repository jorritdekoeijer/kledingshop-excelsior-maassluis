"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Officiële kleding en merchandise voor Excelsior Maassluis",
  "Bestellen zonder account — ook voor staf en supporters",
  "Beheer van de shop: alleen voor de kledingcommissie (inloggen)"
];

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="border-b border-slate-200 bg-[#f1f5f9] text-black">
      <div className="mx-auto flex max-w-[1800px] items-center justify-center px-4 py-2.5 text-center text-xs font-medium sm:text-sm">
        <span className="inline-flex items-center gap-2">
          <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <span key={index}>{MESSAGES[index]}</span>
        </span>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="8" fill="currentColor" className="text-emerald-500/20" />
      <path
        d="M4.5 8.2 7 10.7 11.5 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-600"
      />
    </svg>
  );
}
