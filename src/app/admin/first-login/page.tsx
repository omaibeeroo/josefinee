import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { FirstLoginForm } from "./form";

export const metadata: Metadata = {
  title: "Set your password",
  robots: { index: false, follow: false },
};

export default async function FirstLoginPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md">
        <p className="text-center font-display text-3xl tracking-[0.12em]">Hanadi Store</p>
        <h1 className="mt-4 text-center font-display text-2xl">Set a new password</h1>
        <p className="mt-2 text-center text-sm text-ink-soft">
          For security, the initial password must be changed before you continue.
        </p>
        <FirstLoginForm />
      </div>
    </div>
  );
}
