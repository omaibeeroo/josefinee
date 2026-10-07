"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteAddressAction, saveAddressAction } from "@/server/actions/account";
import { getCommunesAction } from "@/server/actions/checkout";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
import type { CommuneOption, WilayaOption } from "@/server/delivery";

export type AddressRow = {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  wilayaId: string;
  communeId: string;
  address: string;
  isDefault: boolean;
  wilaya: { name: string };
  commune: { name: string };
};

export function AddressesManager({
  initial,
  wilayas,
}: {
  initial: AddressRow[];
  wilayas: WilayaOption[];
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<AddressRow> & { id?: string } | null>(null);
  const [communes, setCommunes] = useState<CommuneOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function startEdit(address?: AddressRow) {
    setError(null);
    if (!address) {
      setEditing({ firstName: "", lastName: "", phone: "", wilayaId: "", communeId: "", address: "", isDefault: initial.length === 0 });
      setCommunes([]);
      return;
    }
    setEditing({ ...address });
    setCommunes(await getCommunesAction(address.wilayaId));
  }

  async function onWilayaChange(wilayaId: string) {
    setEditing((previous) => (previous ? { ...previous, wilayaId, communeId: "" } : previous));
    setCommunes(wilayaId ? await getCommunesAction(wilayaId) : []);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    setError(null);
    const result = await saveAddressAction({
      id: editing.id,
      label: editing.label ?? undefined,
      firstName: editing.firstName ?? "",
      lastName: editing.lastName ?? "",
      phone: editing.phone ?? "",
      wilayaId: editing.wilayaId ?? "",
      communeId: editing.communeId ?? "",
      address: editing.address ?? "",
      isDefault: editing.isDefault ?? false,
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
    await deleteAddressAction(id);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => void startEdit()}>
          {t.account.addAddress}
        </Button>
      </div>

      {initial.length === 0 && !editing && (
        <p className="border hairline bg-white p-6 text-center text-ink-soft">
          {t.account.noAddress}
        </p>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {initial.map((address) => (
          <li key={address.id} className="border hairline bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">
                {address.label || `${address.firstName} ${address.lastName}`}
                {address.isDefault && (
                  <span className="ml-2 text-[0.6875rem] uppercase tracking-[0.14em] text-gold-dark">{t.account.isDefault}</span>
                )}
              </p>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {address.firstName} {address.lastName} · {address.phone}
            </p>
            <p className="text-sm text-ink-soft">
              {address.address}, {address.commune.name}, {address.wilaya.name}
            </p>
            <div className="mt-3 flex gap-3 text-xs uppercase tracking-[0.14em]">
              <button type="button" onClick={() => void startEdit(address)} className="underline underline-offset-2">
                {t.account.edit}
              </button>
              <button type="button" onClick={() => void remove(address.id)} className="text-ink-muted underline underline-offset-2">
                {t.account.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <form onSubmit={submit} className="mt-6 space-y-4 border hairline bg-white p-6">
          <h2 className="font-display text-2xl">{editing.id ? t.account.editAddress : t.account.newAddress}</h2>
          <Field label={t.account.labelOptional}>
            <Input value={editing.label ?? ""} onChange={(event) => setEditing({ ...editing, label: event.target.value })} placeholder={t.account.labelHint} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.auth.firstName}>
              <Input value={editing.firstName ?? ""} onChange={(event) => setEditing({ ...editing, firstName: event.target.value })} required />
            </Field>
            <Field label={t.auth.lastName}>
              <Input value={editing.lastName ?? ""} onChange={(event) => setEditing({ ...editing, lastName: event.target.value })} required />
            </Field>
          </div>
          <Field label={t.auth.phone}>
            <Input value={editing.phone ?? ""} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} inputMode="tel" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.account.wilaya}>
              <Select value={editing.wilayaId ?? ""} onChange={(event) => void onWilayaChange(event.target.value)} required>
                <option value="">{t.account.choose}</option>
                {wilayas.map((wilaya) => (
                  <option key={wilaya.id} value={wilaya.id}>
                    {String(wilaya.code).padStart(2, "0")} — {wilaya.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.account.commune}>
              <Select value={editing.communeId ?? ""} onChange={(event) => setEditing({ ...editing, communeId: event.target.value })} required>
                <option value="">{t.account.choose}</option>
                {communes.map((commune) => (
                  <option key={commune.id} value={commune.id}>
                    {commune.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t.account.address}>
            <Textarea value={editing.address ?? ""} onChange={(event) => setEditing({ ...editing, address: event.target.value })} required rows={2} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(editing.isDefault)}
              onChange={(event) => setEditing({ ...editing, isDefault: event.target.checked })}
              className="h-4 w-4 accent-[#1c1a17]"
            />
            {t.account.setDefault}
          </label>
          {error && (
            <p className="text-sm text-[#9e342e]" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? t.account.saving : t.account.saveAddress}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
