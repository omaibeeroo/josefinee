"use client";

import { useState, useTransition } from "react";
import { unsubscribeAction } from "@/server/actions/engagement";

export function UnsubscribeForm({ token }: { token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmUnsubscribe() {
    setError(null);
    startTransition(() => {
      void unsubscribeAction(token)
        .then((result) => {
          if (result.ok) setMessage("Votre désinscription est confirmée. Vous ne recevrez plus notre newsletter.");
          else setError(result.error);
        })
        .catch(() => setError("La demande n’a pas pu aboutir. Veuillez réessayer."));
    });
  }

  if (message) return <p className="mt-3 text-ink-soft" role="status">{message}</p>;

  return (
    <div className="mt-8">
      <button type="button" className="btn btn-primary" disabled={pending} onClick={confirmUnsubscribe}>
        {pending ? "Désinscription…" : "Confirmer ma désinscription"}
      </button>
      {error && <p className="mt-3 text-sm text-[#9e342e]" role="alert">{error}</p>}
    </div>
  );
}
