"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adjustStockAction, listInventoryTransactions } from "@/server/actions/admin-inventory";
import { Button, Field, Input } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
import { formatDateTimeFR } from "@/lib/money";

export function StockAdjuster({ variantId, current }: { variantId: string; current: number }) {
  const router = useRouter();
  const { locale, t } = useLocale();
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
          <Field label={t.adminInventory.stock}>
            <Input type="number" min={0} value={stock} onChange={(event) => setStock(event.target.value)} aria-label={t.adminInventory.stock} />
          </Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label={t.adminInventory.reason}>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t.adminInventory.reasonPh} aria-label={t.adminInventory.reason} />
          </Field>
        </div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "…" : t.adminInventory.set}
        </Button>
      </form>
      {error && (
        <p className="mt-1 text-xs text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <button type="button" onClick={() => void loadHistory()} className="mt-1 text-xs text-ink-muted underline underline-offset-2">
        {history ? t.adminInventory.hideHistory : t.adminInventory.showHistory}
      </button>
      {history && history.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-ink-soft">
          {history.map((entry) => (
            <li key={entry.id}>
              {formatDateTimeFR(entry.createdAt, locale)} · {entry.type} {entry.quantity > 0 ? "+" : ""}
              {entry.quantity} → {t.adminInventory.stockAfter} {entry.stockAfter}
              {entry.reason ? ` · ${entry.reason}` : ""}
              {entry.user ? ` · ${t.adminInventory.by} ${entry.user.name}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
