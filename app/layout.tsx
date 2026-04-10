import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kledingshop Excelsior Maassluis",
  description: "Kledingshop"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-dvh bg-white text-zinc-900 antialiased">{children}</body>
    </html>
  );
}

