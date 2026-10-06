import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Se connecter",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="container-luxe py-12 md:py-16">
      <div className="text-center">
        <p className="eyebrow mb-2">Bon retour</p>
        <h1 className="font-display text-4xl font-medium">Se connecter</h1>
      </div>
      <LoginForm />
    </div>
  );
}
