"use client";

import { useState, type FormEvent } from "react";
import { submitContactAction } from "@/server/actions/engagement";
import { Button, Field, Honeypot, Input, Textarea } from "@/components/ui";

export function ContactForm({
  supportEmail,
  supportPhone,
  supportHours,
}: {
  supportEmail: string;
  supportPhone: string;
  supportHours: string;
}) {
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
    <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
      <div>
        <h2 className="font-display text-2xl font-medium">Parlons-nous</h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          Commande, produit ou livraison : dites-nous tout, nous nous occupons du reste.
        </p>
        <dl className="mt-8 space-y-0 text-sm">
          {supportEmail && (
            <div className="border-t hairline py-4">
              <dt className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ink-muted">
                E-mail
              </dt>
              <dd className="mt-1.5">
                <a
                  href={`mailto:${supportEmail}`}
                  className="underline underline-offset-4 hover:text-gold-dark"
                >
                  {supportEmail}
                </a>
              </dd>
            </div>
          )}
          {supportPhone && (
            <div className="border-t hairline py-4">
              <dt className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ink-muted">
                Téléphone
              </dt>
              <dd className="mt-1.5">{supportPhone}</dd>
            </div>
          )}
          {supportHours && (
            <div className="border-y hairline py-4">
              <dt className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ink-muted">
                Horaires
              </dt>
              <dd className="mt-1.5 text-ink-soft">{supportHours}</dd>
            </div>
          )}
        </dl>
      </div>
      <form onSubmit={submit} className="relative space-y-5">
        <Honeypot value={form.website} onChange={(value) => set("website", value)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nom" required>
            <Input value={form.name} onChange={(event) => set("name", event.target.value)} required />
          </Field>
          <Field label="E-mail" required>
            <Input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} required />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Téléphone (optionnel)">
            <Input value={form.phone} onChange={(event) => set("phone", event.target.value)} inputMode="tel" />
          </Field>
          <Field label="Objet" required>
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
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Envoi en cours…" : "Envoyer le message"}
        </Button>
      </form>
    </div>
  );
}
