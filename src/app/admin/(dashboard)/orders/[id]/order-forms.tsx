"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changeOrderStatusAction, updateAdminNotesAction } from "@/server/actions/admin-orders";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { Button, Field, Select, Textarea } from "@/components/ui";
import type { OrderStatus } from "@prisma/client";

export function StatusChanger({
  orderId,
  current,
  allowed,
}: {
  orderId: string;
  current: OrderStatus;
  allowed: OrderStatus[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(allowed[0] ?? current);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await changeOrderStatusAction(orderId, status, note || undefined, notify);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (allowed.length === 0) {
    return <p className="text-sm text-ink-muted">This order is closed — no further transitions.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="New status">
        <Select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
          {allowed.map((option) => (
            <option key={option} value={option}>
              {ORDER_STATUS_LABELS[option].label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Note (optional)">
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} className="h-4 w-4 accent-[#1c1a17]" />
        Notify the customer
      </label>
      {error && (
        <p className="text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} size="sm" className="w-full">
        {pending ? "Updating…" : "Update status"}
      </Button>
    </form>
  );
}

export function NotesEditor({ orderId, initial }: { orderId: string; initial: string | null }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    await updateAdminNotesAction(orderId, notes);
    setPending(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Internal notes (never shown to the customer)">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </Field>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Save notes"}
      </Button>
      {saved && (
        <p className="text-sm text-ink-soft" role="status">
          Saved.
        </p>
      )}
    </form>
  );
}
