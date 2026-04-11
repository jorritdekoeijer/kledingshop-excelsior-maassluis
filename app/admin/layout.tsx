import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/admin" className="font-semibold text-brand-blue">
            Admin
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/admin/roles" className="text-zinc-700 hover:text-brand-blue">
              Rollen
            </Link>
            <Link href="/admin/settings" className="text-zinc-700 hover:text-brand-blue">
              Instellingen
            </Link>
            <Link href="/dashboard" className="text-zinc-700 hover:text-brand-blue">
              Beheer
            </Link>
            <Link href="/" className="text-zinc-500 hover:text-brand-blue">
              Shop
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
