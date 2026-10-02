"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adjustStockAction, listInventoryTransactions } from "@/server/actions/admin-inventory";
import { Button, Field, Input } from "@/components/ui";

export function StockAdjuster({ variantId, current }: { variantId: string; current: number }) {
  const router = useRouter();
  const [stock, setStock] = useState(String(current));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listInventoryTransactions>> | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await adjustStockAction({ variantId, stock: Number(stock), reason: reason || undefined });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function loadHistory() {
    setHistory(await listInventoryTransactions(variantId));
  }

  return (
    <div>
      <form onSubmit={submit} className="flex items-end gap-2">
        <div className="w-24">
          <Field label="Stock">
            <Input type="number" min={0} value={stock} onChange={(event) => setStock(event.target.value)} aria-label="New stock" />
          </Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Reason">
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Restock, correction…" aria-label="Reason" />
          </Field>
        </div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "…" : "Set"}
        </Button>
      </form>
      {error && (
        <p className="mt-1 text-xs text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <button type="button" onClick={() => void loadHistory()} className="mt-1 text-xs text-ink-muted underline underline-offset-2">
        {history ? "Hide history" : "Show history"}
      </button>
      {history && history.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-ink-soft">
          {history.map((entry) => (
            <li key={entry.id}>
              {new Date(entry.createdAt).toLocaleString("fr-DZ")} · {entry.type} {entry.quantity > 0 ? "+" : ""}
              {entry.quantity} → {entry.stockAfter}
              {entry.reason ? ` · ${entry.reason}` : ""}
              {entry.user ? ` · ${entry.user.name}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
