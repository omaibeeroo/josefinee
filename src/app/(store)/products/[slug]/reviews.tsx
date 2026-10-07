"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, Star } from "lucide-react";
import { submitReviewAction } from "@/server/actions/engagement";
import { Button, Field, Honeypot, Input, Textarea } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function ReviewToggle({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="mx-auto flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-ink underline underline-offset-8 hover:text-gold-dark"
      >
        {t.reviews.toggle}
        <Plus
          size={14}
          className={cn("transition-transform duration-300", open && "rotate-45")}
          aria-hidden="true"
        />
      </button>
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  );
}

export function ReviewForm({ productId }: { productId: string }) {
  const { t } = useLocale();
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await submitReviewAction({ productId, rating, title, body, authorName, website });
    setState({ ok: result.ok, message: result.ok ? result.message : result.error });
    if (result.ok) {
      setTitle("");
      setBody("");
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="review-form relative mx-auto mt-6 max-w-xl space-y-3 text-left">
      <Honeypot value={website} onChange={setWebsite} />
      <h3 className="text-center font-display text-xl font-medium">{t.product.giveReview}</h3>
      <div>
        <span className="field-label">{t.product.yourRating}</span>
        <div className="flex justify-center gap-1" role="radiogroup" aria-label={t.product.rating}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} ${value > 1 ? t.product.stars : t.product.star}`}
              onClick={() => setRating(value)}
              className="p-1"
            >
              <Star
                size={20}
                className={cn(value <= rating ? "fill-gold text-gold" : "text-line")}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
      <Field label={t.product.yourName} required>
        <Input value={authorName} onChange={(event) => setAuthorName(event.target.value)} required maxLength={80} />
      </Field>
      <Field label={t.product.title}>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
      </Field>
      <Field label={t.product.review} required>
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={2000} />
      </Field>
      {state && (
        <p className={`text-sm ${state.ok ? "text-ink-soft" : "text-sale"}`} role="status">
          {state.message}
        </p>
      )}
      <div className="pt-1 text-center">
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? t.product.sending : t.product.submitReview}
        </Button>
      </div>
    </form>
  );
}
