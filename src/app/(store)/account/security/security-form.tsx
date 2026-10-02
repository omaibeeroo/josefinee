"use client";

import { useState, type FormEvent } from "react";
import { changePasswordAction } from "@/server/actions/engagement";
import { Button, Field, Input } from "@/components/ui";

export function SecurityForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await changePasswordAction({ current, next });
    setState({ ok: result.ok, message: result.ok ? result.message : result.error });
    if (result.ok) {
      setCurrent("");
      setNext("");
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4 border hairline bg-white p-6">
      <h2 className="font-display text-2xl">Change password</h2>
      <Field label="Current password">
        <Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="10+ characters, upper & lower case, a number">
        <Input type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" required />
      </Field>
      {state && (
        <p className={`text-sm ${state.ok ? "text-ink-soft" : "text-sale"}`} role="status">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
