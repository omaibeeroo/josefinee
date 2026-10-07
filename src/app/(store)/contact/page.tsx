import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { BRAND_CONFIG } from "@/config/brand";
import { getDictionary } from "@/lib/i18n/server";
import { ContactForm } from "./contact-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.contact.title, description: t.contact.description };
}

export default async function ContactPage() {
  const [settings, t] = await Promise.all([getSettings(), getDictionary()]);
  return (
    <div className="container-luxe max-w-4xl py-10 md:py-14">
      <div className="mb-8 text-center md:mb-10">
        <p className="eyebrow mb-3">{t.contact.eyebrow}</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">{t.contact.heading}</h1>
        <p className="mx-auto mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
          {t.contact.intro}
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
