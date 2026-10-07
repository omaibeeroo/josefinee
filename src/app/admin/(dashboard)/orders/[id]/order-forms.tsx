"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changeOrderStatusAction, updateAdminNotesAction } from "@/server/actions/admin-orders";
import { Button, Field, Select, Textarea } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
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
  const { t } = useLocale();
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
    return <p className="text-sm text-ink-muted">{t.admin.orderClosed}</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={t.admin.newStatus}>
        <Select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
          {allowed.map((option) => (
            <option key={option} value={option}>
              {t.status[option]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t.admin.noteOptional}>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} className="h-4 w-4 accent-[#1c1a17]" />
        {t.admin.notifyCustomer}
      </label>
      {error && (
        <p className="text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} size="sm" className="w-full">
        {pending ? t.admin.updating : t.admin.updateStatus}
      </Button>
    </form>
  );
}

export function NotesEditor({ orderId, initial }: { orderId: string; initial: string | null }) {
  const router = useRouter();
  const { t } = useLocale();
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
      <Field label={t.admin.internalNotes}>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </Field>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? t.admin.saving : t.admin.saveNotes}
      </Button>
      {saved && (
        <p className="text-sm text-ink-soft" role="status">
          {t.admin.saved}
        </p>
      )}
    </form>
  );
}
