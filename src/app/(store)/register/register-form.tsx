"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mergeWishlistAction, registerAction } from "@/server/actions/engagement";
import { clearGuestWishlist, readGuestWishlist } from "@/components/storefront/product";
import { Button, Field, Input } from "@/components/ui";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFields({});
    const result = await registerAction(form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      if ("fields" in result && result.fields) setFields(result.fields as Record<string, string>);
      return;
    }
    const guestIds = readGuestWishlist();
    if (guestIds.length > 0) {
      await mergeWishlistAction(guestIds).catch(() => undefined);
      clearGuestWishlist();
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto mt-8 max-w-md space-y-4 border hairline bg-white p-6 md:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required error={fields.firstName}>
          <Input value={form.firstName} onChange={(event) => set("firstName", event.target.value)} autoComplete="given-name" />
        </Field>
        <Field label="Last name" required error={fields.lastName}>
          <Input value={form.lastName} onChange={(event) => set("lastName", event.target.value)} autoComplete="family-name" />
        </Field>
      </div>
      <Field label="Email" required error={fields.email}>
        <Input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} autoComplete="email" />
      </Field>
      <Field label="Phone" required error={fields.phone} hint="Algerian mobile, e.g. 0550 12 34 56">
        <Input value={form.phone} onChange={(event) => set("phone", event.target.value)} inputMode="tel" autoComplete="tel" />
      </Field>
      <Field label="Password" required error={fields.password} hint="10+ characters, upper & lower case, a number">
        <Input type="password" value={form.password} onChange={(event) => set("password", event.target.value)} autoComplete="new-password" />
      </Field>
      {error && (
        <p className="text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
