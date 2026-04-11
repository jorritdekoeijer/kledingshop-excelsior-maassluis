import Link from "next/link";
import { CartView } from "@/components/shop/cart/CartView";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";

export const metadata = {
  title: "Winkelmand"
};

export default function CartPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/shop" className="text-sm text-brand-blue hover:underline">
          ← Verder winkelen
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-brand-blue">Winkelmand</h1>
        <div className="mt-6">
          <CartView />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
