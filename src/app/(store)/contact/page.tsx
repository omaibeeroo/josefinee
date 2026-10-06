import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { BRAND_CONFIG } from "@/config/brand";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Nous contacter",
  description: "Contactez notre service client pour toute question sur une commande ou une livraison.",
};

export default async function ContactPage() {
  const settings = await getSettings();
  return (
    <div className="container-luxe max-w-4xl py-10 md:py-14">
      <div className="mb-8 text-center md:mb-10">
        <p className="eyebrow mb-3">Service client</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Contactez-nous</h1>
        <p className="mx-auto mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
          Une question sur une commande, une pièce ou une livraison ? Écrivez-nous, nous vous
          répondons sous un jour ouvré.
        </p>
      </div>
      <ContactForm
        supportEmail={settings.general.email}
        supportPhone={settings.general.phone}
        supportHours={BRAND_CONFIG.supportHours}
      />
    </div>
  );
}
