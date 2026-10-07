"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { setCustomerStatusAction, updateCustomerNotesAction } from "@/server/actions/admin-ops";
import { Button, Field, Textarea } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";

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
  const { t } = useLocale();
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
    if (!window.confirm(status === "ACTIVE" ? t.adminCustomerForm.blockConfirm : t.adminCustomerForm.unblockConfirm)) return;
    await setCustomerStatusAction(id, status === "ACTIVE" ? "BLOCKED" : "ACTIVE");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={saveNotes} className="space-y-3">
        <Field label={t.adminCustomerForm.riskNotes}>
          <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} />
        </Field>
        <Button type="submit" size="sm">
          {t.adminCustomerForm.saveNotes}
        </Button>
        {saved && (
          <p className="text-sm text-ink-soft" role="status">
            {t.admin.saved}
          </p>
        )}
      </form>
      <Button type="button" variant="outline" size="sm" onClick={() => void toggleStatus()}>
        {status === "ACTIVE" ? t.adminCustomerForm.block : t.adminCustomerForm.unblock}
      </Button>
    </div>
  );
}
