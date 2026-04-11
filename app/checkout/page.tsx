import Link from "next/link";
import { CheckoutForm } from "@/app/checkout/CheckoutForm";
import { PublicFooter } from "@/components/shop/PublicFooter";
import { PublicHeader } from "@/components/shop/PublicHeader";

export const metadata = {
  title: "Afrekenen"
};

export default function CheckoutPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
        <Link href="/cart" className="text-sm text-brand-blue hover:underline">
          ← Terug naar winkelmand
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-brand-blue">Afrekenen</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Je wordt daarna doorgestuurd naar Mollie om veilig te betalen (o.a. iDEAL).
        </p>
        <div className="mt-8">
          <CheckoutForm />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
