"use client";

import { useState, type FormEvent } from "react";
import { submitReviewAction } from "@/server/actions/engagement";
import { Button, Field, Honeypot, Input, Stars, Textarea } from "@/components/ui";

export function ReviewForm({ productId }: { productId: string }) {
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
    <form onSubmit={submit} className="relative mt-6 max-w-xl space-y-4 border hairline bg-white p-5 md:p-6">
      <Honeypot value={website} onChange={setWebsite} />
      <h3 className="font-display text-2xl">Write a review</h3>
      <div>
        <span className="field-label">Your rating *</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              onClick={() => setRating(value)}
              className="p-1"
            >
              <span className={value <= rating ? "text-gold" : "text-line"}>
                <Stars value={value <= rating ? 1 : 0} />
              </span>
            </button>
          ))}
        </div>
      </div>
      <Field label="Your name" required>
        <Input value={authorName} onChange={(event) => setAuthorName(event.target.value)} required maxLength={80} />
      </Field>
      <Field label="Title">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
      </Field>
      <Field label="Review" required>
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={2000} />
      </Field>
      {state && (
        <p className={`text-sm ${state.ok ? "text-ink-soft" : "text-sale"}`} role="status">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Submit review"}
      </Button>
    </form>
  );
}
