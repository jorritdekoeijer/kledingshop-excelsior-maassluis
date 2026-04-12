"use client";

import { useEffect, useMemo, useState } from "react";

export type AnnouncementLine = { text: string; enabled: boolean };

export function AnnouncementBar({ lines }: { lines: AnnouncementLine[] }) {
  const messages = useMemo(() => {
    return lines.filter((l) => l.enabled && l.text.trim().length > 0).map((l) => l.text.trim());
  }, [lines]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [messages.length]);

  useEffect(() => {
    setIndex(0);
  }, [messages.join("|")]);

  if (messages.length === 0) return null;

  const current = messages[index % messages.length];

  return (
    <div className="border-b border-slate-200 bg-[#f1f5f9] text-black">
      <div className="mx-auto flex max-w-[1800px] items-center justify-center px-4 py-2.5 text-center text-xs font-medium sm:text-sm">
        <span className="inline-flex items-center gap-2">
          <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <span key={current}>{current}</span>
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
