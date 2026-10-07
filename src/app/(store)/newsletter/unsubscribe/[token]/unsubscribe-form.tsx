"use client";

import { useState, useTransition } from "react";
import { unsubscribeAction } from "@/server/actions/engagement";
import { useLocale } from "@/lib/i18n/provider";

export function UnsubscribeForm({ token }: { token: string }) {
  const { t } = useLocale();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmUnsubscribe() {
    setError(null);
    startTransition(() => {
      void unsubscribeAction(token)
        .then((result) => {
          if (result.ok) setMessage(t.unsubscribe.confirmed);
          else setError(result.error);
        })
        .catch(() => setError(t.unsubscribe.failed));
    });
  }

  if (message) return <p className="mt-3 text-ink-soft" role="status">{message}</p>;

  return (
    <div className="mt-8">
      <button type="button" className="btn btn-primary" disabled={pending} onClick={confirmUnsubscribe}>
        {pending ? t.unsubscribe.working : t.unsubscribe.confirmCta}
      </button>
      {error && <p className="mt-3 text-sm text-[#9e342e]" role="alert">{error}</p>}
    </div>
  );
}
