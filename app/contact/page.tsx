import type { Metadata } from "next";
import Link from "next/link";
import { SimpleContentPage } from "@/components/shop/SimpleContentPage";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Kledingshop Excelsior Maassluis."
};

export default function ContactPage() {
  return (
    <SimpleContentPage>
      <nav className="mb-8 text-sm text-zinc-600">
        <Link href="/" className="text-brand-blue hover:underline">
          ← Home
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold text-brand-blue">Contact</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-700">
        Voor vragen over je bestelling, levering of de clubcollectie kun je terecht bij de{" "}
        <strong>kledingcommissie</strong> van Excelsior Maassluis via de gebruikelijke clubkanalen (website, social
        media, bestuur).
      </p>
      <p className="mt-4 text-sm leading-relaxed text-zinc-700">
        <strong>Tip voor livegang:</strong> vul hier (of op de clubwebsite) een vast e-mailadres en/of telefoonnummer
        in voor de commissie, zodat klanten direct weten waar ze terechtkunnen.
      </p>
      <p className="mt-6 text-sm text-zinc-600">
        Shop-assortiment:{" "}
        <Link href="/shop" className="font-medium text-brand-blue hover:underline">
          Bekijk het assortiment
        </Link>
      </p>
    </SimpleContentPage>
  );
}
