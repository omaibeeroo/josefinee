"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { lookupOrderAction } from "@/server/actions/checkout";
import { Button, Field, Input } from "@/components/ui";

export function TrackForm() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await lookupOrderAction(orderNumber, phone);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/order/${result.orderNumber}?t=${encodeURIComponent(result.trackingToken)}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-8 max-w-md space-y-4 border hairline bg-white p-6">
      <Field label="Order number" required>
        <Input
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
          placeholder="JOS-2026-000123"
          autoComplete="off"
          required
        />
      </Field>
      <Field label="Phone number" required hint="The number you used when ordering">
        <Input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="0550 12 34 56"
          required
        />
      </Field>
      {error && (
        <p className="text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Looking up…" : "Track my order"}
      </Button>
    </form>
  );
}
