import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.auth.registerTitle, robots: { index: false, follow: false } };
}

export default async function RegisterPage() {
  const t = await getDictionary();
  return (
    <div className="container-luxe py-12 md:py-16">
      <div className="text-center">
        <p className="eyebrow mb-2">{t.auth.registerEyebrow}</p>
        <h1 className="font-display text-4xl font-medium">{t.auth.registerTitle}</h1>
        <p className="mt-3 text-ink-soft">{t.auth.registerHint}</p>
      </div>
      <RegisterForm />
    </div>
  );
}
