"use client";

import { useState, type FormEvent } from "react";
import { submitContactAction } from "@/server/actions/engagement";
import { Button, Field, Honeypot, Input, Textarea } from "@/components/ui";

export function ContactForm({ supportEmail, supportPhone }: { supportEmail: string; supportPhone: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "", website: "" });
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await submitContactAction(form);
    setState({ ok: result.ok, message: result.ok ? result.message : result.error });
    if (result.ok) setForm({ name: "", email: "", phone: "", subject: "", message: "", website: "" });
    setPending(false);
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
      <div>
        <h2 className="font-display text-2xl">Talk to us</h2>
        <p className="mt-3 text-ink-soft">
          Questions about an order, a product or delivery? We usually reply within one business day.
        </p>
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="field-label">Email</dt>
            <dd>
              <a href={`mailto:${supportEmail}`} className="underline underline-offset-2">
                {supportEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="field-label">Phone</dt>
            <dd>{supportPhone}</dd>
          </div>
        </dl>
      </div>
      <form onSubmit={submit} className="relative space-y-4 border hairline bg-white p-6">
        <Honeypot value={form.website} onChange={(value) => set("website", value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(event) => set("name", event.target.value)} required />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone (optional)">
            <Input value={form.phone} onChange={(event) => set("phone", event.target.value)} inputMode="tel" />
          </Field>
          <Field label="Subject" required>
            <Input value={form.subject} onChange={(event) => set("subject", event.target.value)} required />
          </Field>
        </div>
        <Field label="Message" required>
          <Textarea value={form.message} onChange={(event) => set("message", event.target.value)} required rows={5} />
        </Field>
        {state && (
          <p className={`text-sm ${state.ok ? "text-ink-soft" : "text-sale"}`} role="status">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send message"}
        </Button>
      </form>
    </div>
  );
}
