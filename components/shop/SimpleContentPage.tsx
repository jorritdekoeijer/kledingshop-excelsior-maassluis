import type { ReactNode } from "react";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";

export function SimpleContentPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">{children}</main>
      <PublicFooter />
    </div>
  );
}
