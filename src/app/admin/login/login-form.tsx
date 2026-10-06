"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminLoginAction } from "@/server/actions/admin-auth";
import { Button, Field, Input } from "@/components/ui";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await adminLoginAction({ email, password, totp: totp || undefined });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      if ("needsTotp" in result && result.needsTotp) setNeedsTotp(true);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 border hairline bg-white p-6 md:p-8">
      <Field label="E-mail" required>
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
      </Field>
      <Field label="Mot de passe" required>
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      </Field>
      {(needsTotp || totp) && (
        <Field label="Code d’authentification" required hint="Code à 6 chiffres de votre application">
          <Input value={totp} onChange={(event) => setTotp(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
        </Field>
      )}
      {error && (
        <p className="text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
