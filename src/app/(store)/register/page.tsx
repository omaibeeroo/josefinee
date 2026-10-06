import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Créer un compte",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div className="container-luxe py-12 md:py-16">
      <div className="text-center">
        <p className="eyebrow mb-2">Rejoignez-nous</p>
        <h1 className="font-display text-4xl font-medium">Créer un compte</h1>
        <p className="mt-3 text-ink-soft">Commander sans compte est toujours possible — un compte garde votre historique.</p>
      </div>
      <RegisterForm />
    </div>
  );
}
