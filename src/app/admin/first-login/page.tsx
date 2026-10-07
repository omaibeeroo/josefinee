import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/server";
import { FirstLoginForm } from "./form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.firstLogin.title, robots: { index: false, follow: false } };
}

export default async function FirstLoginPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const t = await getDictionary();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-[#eef1f4] px-4">
      <div className="w-full max-w-md">
        <p className="text-center font-display text-3xl tracking-[0.12em]">Hanadi Store</p>
        <h1 className="mt-4 text-center font-display text-2xl">{t.firstLogin.heading}</h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          {t.firstLogin.hint}
        </p>
        <FirstLoginForm />
      </div>
    </div>
  );
}
