"use client";

import { useState, type FormEvent } from "react";
import { adminFirstLoginAction } from "@/server/actions/admin-auth";
import { Button, Field, Input } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";

export function FirstLoginForm() {
  const { t } = useLocale();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await adminFirstLoginAction({ current, next });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 border hairline bg-white p-6 md:p-8">
      <Field label={t.account.currentPassword} required>
        <Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required />
      </Field>
      <Field label={t.firstLogin.newPassword} required hint={t.auth.passwordHint}>
        <Input type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" required />
      </Field>
      {error && (
        <p className="text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.account.updating : t.firstLogin.submit}
      </Button>
    </form>
  );
}
