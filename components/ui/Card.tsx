import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={["rounded-lg border border-zinc-200 bg-white", className].join(" ")} />;
}

