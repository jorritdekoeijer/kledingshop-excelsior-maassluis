import type { Metadata } from "next";
import Link from "next/link";
import { SimpleContentPage } from "@/components/shop/SimpleContentPage";

export const metadata: Metadata = {
  title: "Algemene voorwaarden",
  description: "Algemene voorwaarden Kledingshop Excelsior Maassluis."
};

export default function TermsPage() {
  return (
    <SimpleContentPage>
      <nav className="mb-8 text-sm text-zinc-600">
        <Link href="/" className="text-brand-blue hover:underline">
          ← Home
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold text-brand-blue">Algemene voorwaarden</h1>
      <p className="mt-2 text-sm text-zinc-500">Concept — pas aan waar nodig voor jullie vereniging</p>

      <div className="mt-8 max-w-none space-y-4 text-sm leading-relaxed text-zinc-700">
        <p>
          Deze voorwaarden gelden voor aankopen via de officiële kledingshop van <strong>Excelsior Maassluis</strong>.
          Door te bestellen ga je akkoord met deze voorwaarden, naast eventuele algemene regels van de vereniging.
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Aanbod en prijzen</h2>
        <p>
          Alle prijzen zijn in euro&apos;s en inclusief btw, tenzij anders vermeld. Het aanbod is onder voorbehoud van
          beschikbaarheid. Wij kunnen typefouten of onjuistheden op de site herstellen.
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Bestelling en betaling</h2>
        <p>
          Een overeenkomst komt tot stand na bevestiging van je bestelling en succesvolle betaling via de gekozen
          betaalmethode (via Mollie), tenzij anders overeengekomen.
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Levering en afhalen</h2>
        <p>
          Levering of afhaalmomenten worden door de club gecommuniceerd (bijv. bij evenementen of vaste momenten).
          Controleer de communicatie op je orderbevestiging en clubkanalen.
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Ruilen en retour</h2>
        <p>
          Voor ruilen, retour en garantie gelden de afspraken van de club. Neem bij vragen contact op via{" "}
          <Link href="/contact" className="text-brand-blue hover:underline">
            contact
          </Link>
          . Pas deze paragraaf aan naar jullie beleid (bijv. termijn, conditie artikelen).
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Aansprakelijkheid</h2>
        <p>
          Wij stellen alles in het werk om de shop betrouwbaar te laten werken. Aansprakelijkheid is beperkt tot het
          bedrag van de betreffende bestelling, voor zover wettelijk toegestaan.
        </p>

        <h2 className="text-lg font-semibold text-zinc-900">Toepasselijk recht</h2>
        <p>Op deze voorwaarden is Nederlands recht van toepassing.</p>
      </div>
    </SimpleContentPage>
  );
}
