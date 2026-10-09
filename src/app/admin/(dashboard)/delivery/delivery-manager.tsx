"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { importDeliveryCsvAction, saveDeliveryRateAction } from "@/server/actions/admin-ops";
import { Button, Field, Input } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
import { formatDA } from "@/lib/money";

export type WilayaRates = {
  id: string;
  code: number;
  name: string;
  isActive: boolean;
  stopdeskAvailable: boolean;
  deliveryRates: Array<{
    id: string;
    method: "HOME" | "STOPDESK" | "EXPRESS" | "STANDARD";
    price: number;
    etaMinDays: number;
    etaMaxDays: number;
    isActive: boolean;
  }>;
};

export function DeliveryManager({ wilayas }: { wilayas: WilayaRates[] }) {
  const router = useRouter();
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ wilayaId: string; wilayaName: string; method: string; price: string; etaMin: string; etaMax: string; isActive: boolean } | null>(null);
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const visible = wilayas.filter((wilaya) =>
    !search.trim() ||
    wilaya.name.toLowerCase().includes(search.trim().toLowerCase()) ||
    String(wilaya.code).includes(search.trim()),
  );

  async function submitRate(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    setError(null);
    const result = await saveDeliveryRateAction({
      wilayaId: editing.wilayaId,
      method: editing.method as "HOME" | "STOPDESK" | "EXPRESS" | "STANDARD",
      price: Number(editing.price),
      etaMinDays: Number(editing.etaMin),
      etaMaxDays: Number(editing.etaMax),
      isActive: editing.isActive,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function importCsv() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await importDeliveryCsvAction(csv);
    setPending(false);
    if (!result.ok) {
      setError("Import failed.");
      return;
    }
    setMessage(`Imported ${result.updated} rates.${result.errors.length > 0 ? ` Issues: ${result.errors.join(" ")}` : ""}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.adminDelivery.searchPh} aria-label={t.adminDelivery.searchLabel} className="max-w-xs" />
        <a
          href="/api/admin/delivery/export"
          className="btn btn-ghost min-h-10 px-4 text-xs"
        >
          {t.adminDelivery.exportCsv}
        </a>
      </div>
      {error && (
        <p className="border border-[#9e342e]/30 bg-red-50 px-4 py-2 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm" role="status">
          {message}
        </p>
      )}

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[760px] text-start text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">Wilaya</th>
              <th className="px-4 py-3">Home</th>
              <th className="px-4 py-3">Stopdesk</th>
              <th className="px-4 py-3">Express</th>
              <th className="px-4 py-3">Standard</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((wilaya) => (
              <tr key={wilaya.id}>
                <td className="px-4 py-3 font-medium">
                  {String(wilaya.code).padStart(2, "0")} — {wilaya.name}
                </td>
                {(["HOME", "STOPDESK", "EXPRESS", "STANDARD"] as const).map((method) => {
                  const rate = wilaya.deliveryRates.find((entry) => entry.method === method);
                  return (
                    <td key={method} className="px-4 py-3">
                      {rate ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              wilayaId: wilaya.id,
                              wilayaName: `${wilaya.code} — ${wilaya.name}`,
                              method,
                              price: String(rate.price),
                              etaMin: String(rate.etaMinDays),
                              etaMax: String(rate.etaMaxDays),
                              isActive: rate.isActive,
                            })
                          }
                          className={`text-start tabular-nums hover:underline ${rate.isActive ? "" : "text-ink-muted line-through"}`}
                          title={`${t.adminDelivery.editRate} ${t.delivery[method as keyof typeof t.delivery]} — ${wilaya.name}`}
                        >
                          {formatDA(rate.price)}
                          <span className="block text-xs text-ink-muted">
                            {rate.etaMinDays}–{rate.etaMaxDays}{t.adminDelivery.daysShort}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({ wilayaId: wilaya.id, wilayaName: `${wilaya.code} — ${wilaya.name}`, method, price: "800", etaMin: "2", etaMax: "4", isActive: true })
                          }
                          className="text-xs text-ink-muted underline underline-offset-2"
                        >
                          {t.adminDelivery.setRate}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <form onSubmit={submitRate} className="grid gap-3 border hairline bg-white p-5 sm:grid-cols-5">
          <p className="font-medium sm:col-span-5">
            {editing.wilayaName} · {t.delivery[editing.method as keyof typeof t.delivery]}
          </p>
          <Field label={t.adminDelivery.priceDa}>
            <Input type="number" min={0} value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} required />
          </Field>
          <Field label={t.adminDelivery.etaMin}>
            <Input type="number" min={0} max={30} value={editing.etaMin} onChange={(event) => setEditing({ ...editing, etaMin: event.target.value })} required />
          </Field>
          <Field label={t.adminDelivery.etaMax}>
            <Input type="number" min={0} max={30} value={editing.etaMax} onChange={(event) => setEditing({ ...editing, etaMax: event.target.value })} required />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} className="h-4 w-4 accent-[#1c1a17]" />
            {t.adminDelivery.active}
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "…" : t.adminDelivery.save}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
              {t.adminDelivery.cancel}
            </Button>
          </div>
        </form>
      )}

      <details className="border hairline bg-white p-5">
        <summary className="cursor-pointer text-sm font-medium uppercase tracking-[0.14em]">
          CSV import (wilaya_code,method,price,eta_min,eta_max,active)
        </summary>
        <textarea
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          rows={5}
          placeholder={"16,HOME,600,1,2,1\n16,STOPDESK,350,1,2,1"}
          className="field mt-3 font-mono text-xs"
        />
        <Button type="button" disabled={pending || !csv.trim()} size="sm" className="mt-3" onClick={() => void importCsv()}>
          {pending ? "Importing…" : "Import CSV"}
        </Button>
      </details>
    </div>
  );
}
