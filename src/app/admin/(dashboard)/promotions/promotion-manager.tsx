"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deletePromotionAction, savePromotionAction } from "@/server/actions/admin-ops";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

export type PromotionRow = {
  id: string;
  name: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  collectionId: string | null;
  collection: { name: string } | null;
  _count: { products: number; orders: number };
};

function toDateTimeLocal(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (entry: number) => String(entry).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PromotionManager({
  promotions,
  collections,
}: {
  promotions: PromotionRow[];
  collections: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{
    id?: string;
    name: string;
    type: "PERCENTAGE" | "FIXED";
    value: number;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
    collectionSlug: string;
    productSkus: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function startNew() {
    const now = new Date();
    const later = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    setError(null);
    setEditing({
      name: "",
      type: "PERCENTAGE",
      value: 10,
      startsAt: toDateTimeLocal(now),
      endsAt: toDateTimeLocal(later),
      isActive: true,
      collectionSlug: "",
      productSkus: "",
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    setError(null);
    const result = await savePromotionAction({
      id: editing.id,
      name: editing.name,
      type: editing.type,
      value: editing.value,
      startsAt: new Date(editing.startsAt).toISOString(),
      endsAt: new Date(editing.endsAt).toISOString(),
      isActive: editing.isActive,
      collectionSlug: editing.collectionSlug || undefined,
      productSkus: editing.productSkus,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Deactivate/delete this promotion? Promotions used by orders are deactivated, never deleted.")) return;
    await deletePromotionAction(id);
    router.refresh();
  }

  const now = Date.now();
  const isLive = (promotion: PromotionRow) =>
    promotion.isActive &&
    new Date(promotion.startsAt).getTime() <= now &&
    new Date(promotion.endsAt).getTime() >= now;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={startNew}>
          New promotion
        </Button>
      </div>
      {error && (
        <p className="mb-3 border border-[#9e342e]/30 bg-red-50 px-4 py-2 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">Promotion</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {promotions.map((promotion) => (
              <tr key={promotion.id}>
                <td className="px-4 py-3 font-medium">
                  {promotion.name}
                  <span className="block text-xs font-normal text-ink-muted">
                    {promotion.collection ? `Collection: ${promotion.collection.name}` : ""}
                    {promotion._count.products > 0 ? `${promotion.collection ? " · " : ""}${promotion._count.products} products` : ""}
                    {!promotion.collection && promotion._count.products === 0 ? "Whole store" : ""}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {promotion.type === "PERCENTAGE" ? `${promotion.value}%` : `${promotion.value} DA`}
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {new Date(promotion.startsAt).toLocaleDateString("fr-DZ")} →{" "}
                  {new Date(promotion.endsAt).toLocaleDateString("fr-DZ")}
                </td>
                <td className="px-4 py-3 text-xs font-medium uppercase tracking-[0.1em]">
                  {isLive(promotion) ? "Live" : promotion.isActive ? "Scheduled" : "Off"}
                </td>
                <td className="px-4 py-3 tabular-nums">{promotion._count.orders}</td>
                <td className="px-4 py-3 text-right text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditing({
                        id: promotion.id,
                        name: promotion.name,
                        type: promotion.type,
                        value: promotion.value,
                        startsAt: toDateTimeLocal(promotion.startsAt),
                        endsAt: toDateTimeLocal(promotion.endsAt),
                        isActive: promotion.isActive,
                        collectionSlug: "",
                        productSkus: "",
                      });
                    }}
                    className="underline underline-offset-2"
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => void remove(promotion.id)} className="ml-3 text-[#9e342e] underline underline-offset-2">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {promotions.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">No promotions yet.</p>}
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-6 space-y-4 border hairline bg-white p-5">
          <h2 className="font-display text-2xl">{editing.id ? `Edit ${editing.name}` : "New promotion"}</h2>
          <p className="text-sm text-ink-soft">
            Automatic discounts need no code — the best applicable promotion is applied at checkout and never stacks.
          </p>
          <Field label="Name" required hint="Shown to customers at checkout, e.g. “Eid Sale”">
            <Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type">
              <Select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as "PERCENTAGE" | "FIXED" })}>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed amount (DA)</option>
              </Select>
            </Field>
            <Field label={editing.type === "FIXED" ? "Amount (DA)" : "Percent (1–90)"} required>
              <Input type="number" min={1} value={editing.value} onChange={(event) => setEditing({ ...editing, value: Number(event.target.value) })} required />
            </Field>
            <label className="flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} className="h-4 w-4 accent-[#1c1a17]" />
              Active
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts at" required>
              <Input type="datetime-local" value={editing.startsAt} onChange={(event) => setEditing({ ...editing, startsAt: event.target.value })} required />
            </Field>
            <Field label="Ends at" required>
              <Input type="datetime-local" value={editing.endsAt} onChange={(event) => setEditing({ ...editing, endsAt: event.target.value })} required />
            </Field>
          </div>
          <Field label="Collection (optional — empty means all collections)">
            <Select value={editing.collectionSlug} onChange={(event) => setEditing({ ...editing, collectionSlug: event.target.value })}>
              <option value="">All collections</option>
              {collections.map((collection) => (
                <option key={collection.slug} value={collection.slug}>
                  {collection.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Product SKUs (optional, comma separated)" hint="Leave both scope fields empty for a store-wide promotion.">
            <Textarea value={editing.productSkus} onChange={(event) => setEditing({ ...editing, productSkus: event.target.value })} rows={2} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Saving…" : "Save promotion"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
