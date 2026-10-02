import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Contact our customer support team.",
};

export default async function ContactPage() {
  const settings = await getSettings();
  return (
    <div className="container-luxe py-12 md:py-16">
      <div className="mb-10 text-center">
        <p className="eyebrow mb-2">Support</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Contact us</h1>
      </div>
      <ContactForm supportEmail={settings.general.email} supportPhone={settings.general.phone} />
    </div>
  );
}
