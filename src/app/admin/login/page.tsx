import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md">
        <p className="text-center font-display text-3xl tracking-[0.3em]">NÛR</p>
        <p className="mt-2 text-center text-xs uppercase tracking-[0.24em] text-ink-muted">
          Store administration
        </p>
        <AdminLoginForm />
        <p className="mt-4 text-center text-xs text-ink-muted">
          Protected area. All sign-in attempts are logged.
        </p>
      </div>
    </div>
  );
}
