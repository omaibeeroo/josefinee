import type { Metadata } from "next";
import { TrackForm } from "./track-form";

export const metadata: Metadata = {
  title: "Suivre ma commande",
  robots: { index: false, follow: false },
};

export default function TrackPage() {
  return (
    <div className="container-luxe py-12 md:py-16">
      <div className="text-center">
        <p className="eyebrow mb-2">Statut de commande</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Suivre ma commande</h1>
        <p className="mt-3 text-ink-soft">Saisissez votre numéro de commande et votre téléphone pour voir son statut.</p>
      </div>
      <TrackForm />
    </div>
  );
}
