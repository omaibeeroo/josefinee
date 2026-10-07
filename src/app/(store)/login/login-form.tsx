"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction, mergeWishlistAction } from "@/server/actions/engagement";
import { clearGuestWishlist, readGuestWishlist } from "@/components/storefront/product";
import { Button, Field, Input } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
import { safeInternalPath } from "@/lib/safe-navigation";

export function LoginForm() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await loginAction({ email, password });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const guestIds = readGuestWishlist();
    if (guestIds.length > 0) {
      await mergeWishlistAction(guestIds).catch(() => undefined);
      clearGuestWishlist();
    }
    router.push(safeInternalPath(searchParams.get("next")));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-8 max-w-md space-y-4 border hairline bg-white p-6 md:p-8">
      <Field label={t.auth.email} required>
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </Field>
      <Field label={t.auth.password} required>
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      </Field>
      {error && (
        <p className="text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.auth.signingIn : t.auth.signIn}
      </Button>
      <p className="text-center text-sm text-ink-soft">
        {t.auth.noAccount}{" "}
        <Link href="/register" className="underline underline-offset-2">
          {t.auth.createOne}
        </Link>
      </p>
    </form>
  );
}
