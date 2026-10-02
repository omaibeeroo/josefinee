import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div className="container-luxe py-12 md:py-16">
      <div className="text-center">
        <p className="eyebrow mb-2">Join us</p>
        <h1 className="font-display text-4xl font-medium">Create account</h1>
        <p className="mt-3 text-ink-soft">Ordering is always possible as a guest — an account keeps your history.</p>
      </div>
      <RegisterForm />
    </div>
  );
}
