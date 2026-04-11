import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-poppins"
});

export const metadata: Metadata = {
  title: {
    default: "Kledingshop Excelsior Maassluis",
    template: "%s | Excelsior Maassluis"
  },
  description: "Officiële kleding en artikelen van Excelsior Maassluis."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl" className={poppins.variable}>
      <body className="min-h-dvh bg-white font-sans text-zinc-900 antialiased">{children}</body>
    </html>
  );
}

