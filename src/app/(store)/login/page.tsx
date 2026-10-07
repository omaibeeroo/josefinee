import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.auth.loginTitle, robots: { index: false, follow: false } };
}

export default async function LoginPage() {
  const t = await getDictionary();
  return (
    <div className="container-luxe py-12 md:py-16">
      <div className="text-center">
        <p className="eyebrow mb-2">{t.auth.loginEyebrow}</p>
        <h1 className="font-display text-4xl font-medium">{t.auth.loginTitle}</h1>
      </div>
      <LoginForm />
    </div>
  );
}
