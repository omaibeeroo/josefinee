import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BRAND_CONFIG } from "@/config/brand";
import { getAdminSession } from "@/lib/auth/session";
import { getAdminLoginRedirect } from "@/lib/auth/admin-login-routing";
import { getDictionary } from "@/lib/i18n/server";
import { AdminLoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.adminLogin.title, robots: { index: false, follow: false } };
}

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  const destination = getAdminLoginRedirect(session);
  if (destination) redirect(destination);
  const t = await getDictionary();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-cream px-4">
      <div className="w-full max-w-md">
        <p className="text-center font-display text-3xl tracking-[0.12em]">{BRAND_CONFIG.name}</p>
        <p className="mt-2 text-center text-xs uppercase tracking-[0.24em] text-ink-muted">
          {t.adminLogin.brand}
        </p>
        <AdminLoginForm />
        <p className="mt-4 text-center text-xs text-ink-muted">{t.adminLogin.protected}</p>
      </div>
    </div>
  );
}
