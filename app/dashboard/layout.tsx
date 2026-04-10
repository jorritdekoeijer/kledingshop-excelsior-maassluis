import Link from "next/link";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-semibold text-brand-blue">
            Dashboard
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/dashboard/settings">Settings</Link>
            <Link href="/dashboard/products">Products</Link>
            <Link href="/dashboard/stock">Stock</Link>
            <Link href="/dashboard/orders">Orders</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

