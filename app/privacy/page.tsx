import type { Metadata } from "next";
import Link from "next/link";
import { SimpleContentPage } from "@/components/shop/SimpleContentPage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacyverklaring Kledingshop Excelsior Maassluis."
};

export default function PrivacyPage() {
  return (
    <SimpleContentPage>
      <nav className="mb-8 text-sm text-zinc-600">
        <Link href="/" className="text-brand-blue hover:underline">
          ← Home
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold text-brand-blue">Privacyverklaring</h1>
      <p className="mt-2 text-sm text-zinc-500">Laatst bijgewerkt: april 2026</p>

      <div className="mt-8 max-w-none space-y-4 text-sm leading-relaxed text-zinc-700">
        <p>
          Deze webwinkel wordt beheerd door <strong>Excelsior Maassluis</strong> (hierna: de club). Wij gaan zorgvuldig
          om met persoonsgegevens die nodig zijn om bestellingen te plaatsen, te betalen en af te handelen.
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Welke gegevens</h2>
        <p>
          Bij een bestelling verwerken we onder meer naam, e-mailadres, telefoonnummer (indien opgegeven) en
          adresgegevens voor levering of afhandeling. Betalingen verlopen via onze betaalprovider (Mollie); wij zien
          geen volledige kaartgegevens.
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Doeleinden</h2>
        <p>
          Gegevens gebruiken we voor het uitvoeren van je bestelling, communicatie over je order, en — waar nodig —
          wettelijke administratieplicht. Commissieleden met login beheren producten en orders in een beveiligde omgeving.
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Bewaartermijn</h2>
        <p>
          We bewaren gegevens niet langer dan nodig is voor deze doeleinden en de wettelijke bewaartermijnen, tenzij
          anders overeengekomen.
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Je rechten</h2>
        <p>
          Je kunt een verzoek indienen om inzage, correctie of verwijdering van je gegevens (rekening houdend met
          administratieve verplichtingen). Neem contact op via de clubkanalen of het contactadres op de{" "}
          <Link href="/contact" className="text-brand-blue hover:underline">
            contactpagina
          </Link>
          .
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Techniek</h2>
        <p>
          Hosting en database kunnen externe diensten gebruiken (bijv. Supabase, Vercel). Functionele en beveiligde
          verbindingen (HTTPS) zijn standaard. Cookies kunnen worden gebruikt voor sessies (bijv. winkelwagen en
          ingelogd beheer).
        </p>

        <p className="text-sm text-zinc-600">
          Voor specifieke vragen over deze verklaring kun je contact opnemen met de club via{" "}
          <Link href="/contact" className="text-brand-blue hover:underline">
            /contact
          </Link>
          .
        </p>
      </div>
    </SimpleContentPage>
  );
}
