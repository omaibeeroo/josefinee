"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteCouponAction, getCouponForEdit, saveCouponAction } from "@/server/actions/admin-ops";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

export type CouponRow = {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  firstOrderOnly: boolean;
  appliesToAll: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  productSkus: string;
  collectionSlugs: string[];
  wilayaCodes: number[];
  _count: { redemptions: number };
};

function toDateInput(value: Date | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

export function CouponManager({
  coupons,
  collections,
  wilayas,
}: {
  coupons: CouponRow[];
  collections: Array<{ slug: string; name: string }>;
  wilayas: Array<{ code: number; name: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<CouponRow & { productSkus: string }> & { id?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    setError(null);
    const result = await saveCouponAction({
      id: editing.id,
      code: editing.code ?? "",
      type: editing.type ?? "PERCENTAGE",
      value: editing.value ?? 10,
      minOrder: editing.minOrder ?? null,
      maxDiscount: editing.maxDiscount ?? null,
      startsAt: editing.startsAt ? new Date(editing.startsAt).toISOString() : undefined,
      endsAt: editing.endsAt ? new Date(editing.endsAt).toISOString() : undefined,
      isActive: editing.isActive ?? true,
      usageLimit: editing.usageLimit ?? null,
      perCustomerLimit: editing.perCustomerLimit ?? null,
      firstOrderOnly: editing.firstOrderOnly ?? false,
      appliesToAll: editing.appliesToAll ?? true,
      productSkus: editing.productSkus ?? "",
      collectionSlugs: editing.collectionSlugs ?? [],
      wilayaCodes: editing.wilayaCodes ?? [],
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
    if (!window.confirm("Deactivate/delete this coupon? Used coupons are deactivated, never deleted.")) return;
    await deleteCouponAction(id);
    router.refresh();
  }

  function toggleList<T>(list: T[] | undefined, value: T): T[] {
    const current = list ?? [];
    return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              code: "",
              type: "PERCENTAGE",
              value: 10,
              isActive: true,
              appliesToAll: true,
              firstOrderOnly: false,
              productSkus: "",
              collectionSlugs: [],
              wilayaCodes: [],
            })
          }
        >
          New coupon
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
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Used</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td className="px-4 py-3 font-mono font-medium">{coupon.code}</td>
                <td className="px-4 py-3">
                  {coupon.type === "PERCENTAGE" ? `${coupon.value}%` : `${coupon.value} DA`}
                  {coupon.minOrder ? <span className="block text-xs text-ink-muted">min {coupon.minOrder} DA</span> : null}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {coupon._count.redemptions}
                  {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                </td>
                <td className="px-4 py-3">{coupon.isActive ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      void getCouponForEdit(coupon.id).then((full) =>
                        setEditing({
                          ...full,
                          startsAt: full.startsAt,
                          endsAt: full.endsAt,
                        }),
                      );
                    }}
                    className="underline underline-offset-2"
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => void remove(coupon.id)} className="ml-3 text-[#9e342e] underline underline-offset-2">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">No coupons yet.</p>}
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-6 space-y-4 border hairline bg-white p-5">
          <h2 className="font-display text-2xl">{editing.id ? `Edit ${editing.code}` : "New coupon"}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Code" required>
              <Input value={editing.code ?? ""} onChange={(event) => setEditing({ ...editing, code: event.target.value.toUpperCase() })} required className="font-mono uppercase" />
            </Field>
            <Field label="Type">
              <Select value={editing.type ?? "PERCENTAGE"} onChange={(event) => setEditing({ ...editing, type: event.target.value as "PERCENTAGE" | "FIXED" })}>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed amount (DA)</option>
              </Select>
            </Field>
            <Field label={editing.type === "FIXED" ? "Amount (DA)" : "Percent (1–90)"} required>
              <Input type="number" min={1} value={editing.value ?? 10} onChange={(event) => setEditing({ ...editing, value: Number(event.target.value) })} required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Min order (DA)">
              <Input type="number" min={0} value={editing.minOrder ?? ""} onChange={(event) => setEditing({ ...editing, minOrder: event.target.value === "" ? null : Number(event.target.value) })} />
            </Field>
            <Field label="Max discount (DA)">
              <Input type="number" min={0} value={editing.maxDiscount ?? ""} onChange={(event) => setEditing({ ...editing, maxDiscount: event.target.value === "" ? null : Number(event.target.value) })} />
            </Field>
            <Field label="Total use limit">
              <Input type="number" min={0} value={editing.usageLimit ?? ""} onChange={(event) => setEditing({ ...editing, usageLimit: event.target.value === "" ? null : Number(event.target.value) })} />
            </Field>
            <Field label="Per-customer limit">
              <Input type="number" min={0} value={editing.perCustomerLimit ?? ""} onChange={(event) => setEditing({ ...editing, perCustomerLimit: event.target.value === "" ? null : Number(event.target.value) })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts at">
              <Input type="datetime-local" value={editing.startsAt ? toDateInput(editing.startsAt as Date) : ""} onChange={(event) => setEditing({ ...editing, startsAt: event.target.value ? (new Date(event.target.value) as unknown as Date) : null })} />
            </Field>
            <Field label="Ends at">
              <Input type="datetime-local" value={editing.endsAt ? toDateInput(editing.endsAt as Date) : ""} onChange={(event) => setEditing({ ...editing, endsAt: event.target.value ? (new Date(event.target.value) as unknown as Date) : null })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.isActive ?? true} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} className="h-4 w-4 accent-[#1c1a17]" />
              Active
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.firstOrderOnly ?? false} onChange={(event) => setEditing({ ...editing, firstOrderOnly: event.target.checked })} className="h-4 w-4 accent-[#1c1a17]" />
              First orders only
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.appliesToAll ?? true} onChange={(event) => setEditing({ ...editing, appliesToAll: event.target.checked })} className="h-4 w-4 accent-[#1c1a17]" />
              Applies to whole bag
            </label>
          </div>
          {!(editing.appliesToAll ?? true) && (
            <>
              <Field label="Product SKUs (comma separated)">
                <Textarea value={editing.productSkus ?? ""} onChange={(event) => setEditing({ ...editing, productSkus: event.target.value })} rows={2} />
              </Field>
              <div>
                <p className="field-label">Collections</p>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto border hairline p-2">
                  {collections.map((collection) => (
                    <label key={collection.slug} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={(editing.collectionSlugs ?? []).includes(collection.slug)}
                        onChange={() => setEditing({ ...editing, collectionSlugs: toggleList(editing.collectionSlugs, collection.slug) })}
                        className="h-4 w-4 accent-[#1c1a17]"
                      />
                      {collection.name}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <div>
            <p className="field-label">Wilaya restriction (empty = all wilayas)</p>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto border hairline p-2">
              {wilayas.map((wilaya) => (
                <label key={wilaya.code} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={(editing.wilayaCodes ?? []).includes(wilaya.code)}
                    onChange={() => setEditing({ ...editing, wilayaCodes: toggleList(editing.wilayaCodes, wilaya.code) })}
                    className="h-4 w-4 accent-[#1c1a17]"
                  />
                  {String(wilaya.code).padStart(2, "0")} {wilaya.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Saving…" : "Save coupon"}
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
