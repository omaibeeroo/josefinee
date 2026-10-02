"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { setCustomerStatusAction, updateCustomerNotesAction } from "@/server/actions/admin-ops";
import { Button, Field, Textarea } from "@/components/ui";

export function CustomerForms({
  id,
  notes,
  status,
}: {
  id: string;
  notes: string | null;
  status: "ACTIVE" | "BLOCKED";
}) {
  const router = useRouter();
  const [text, setText] = useState(notes ?? "");
  const [saved, setSaved] = useState(false);

  async function saveNotes(event: FormEvent) {
    event.preventDefault();
    await updateCustomerNotesAction(id, text);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  async function toggleStatus() {
    if (!window.confirm(status === "ACTIVE" ? "Block this customer? They will be signed out." : "Unblock this customer?")) return;
    await setCustomerStatusAction(id, status === "ACTIVE" ? "BLOCKED" : "ACTIVE");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={saveNotes} className="space-y-3">
        <Field label="Risk notes (internal)">
          <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} />
        </Field>
        <Button type="submit" size="sm">
          Save notes
        </Button>
        {saved && (
          <p className="text-sm text-ink-soft" role="status">
            Saved.
          </p>
        )}
      </form>
      <Button type="button" variant="outline" size="sm" onClick={() => void toggleStatus()}>
        {status === "ACTIVE" ? "Block customer" : "Unblock customer"}
      </Button>
    </div>
  );
}
