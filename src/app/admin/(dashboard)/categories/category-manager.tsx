"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/admin-catalog";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  parent: { name: string } | null;
  _count: { products: number; children: number };
};

export function CategoryManager({
  categories,
}: {
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [editing, setEditing] = useState<Partial<CategoryRow> & { id?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    setError(null);
    const result = await saveCategoryAction({
      id: editing.id,
      name: editing.name ?? "",
      slug: editing.slug || undefined,
      description: editing.description ?? undefined,
      image: editing.image ?? undefined,
      parentId: editing.parentId ?? undefined,
      sortOrder: editing.sortOrder ?? 0,
      isActive: editing.isActive ?? true,
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
    if (!window.confirm(t.adminCatalog.deleteCategoryConfirm)) return;
    const result = await deleteCategoryAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          size="sm"
          onClick={() => setEditing({ name: "", slug: "", description: "", image: "", parentId: null, sortOrder: 0, isActive: true })}
        >
          {t.adminCatalog.newCategory}
        </Button>
      </div>
      {error && (
        <p className="mb-3 border border-[#9e342e]/30 bg-red-50 px-4 py-2 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">{t.adminForm.name}</th>
              <th className="px-4 py-3">{t.adminForm.slug}</th>
              <th className="px-4 py-3">{t.adminCatalog.parent}</th>
              <th className="px-4 py-3">{t.adminCatalog.productsCol}</th>
              <th className="px-4 py-3">{t.adminForm.active}</th>
              <th className="px-4 py-3 text-end">{t.adminForm.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-3 font-medium">
                  {category.parentId ? <span className="me-2 text-ink-muted">↳</span> : null}
                  {category.name}
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">/{category.slug}</td>
                <td className="px-4 py-3 text-xs">{category.parent?.name ?? t.adminCatalog.none}</td>
                <td className="px-4 py-3 tabular-nums">{category._count.products}</td>
                <td className="px-4 py-3">{category.isActive ? t.adminCoupon.yes : t.adminCoupon.no}</td>
                <td className="px-4 py-3 text-end text-xs">
                  <button type="button" onClick={() => { setError(null); setEditing({ ...category }); }} className="underline underline-offset-2">
                    {t.adminForm.edit}
                  </button>
                  <button type="button" onClick={() => void remove(category.id)} className="ms-3 text-[#9e342e] underline underline-offset-2">
                    {t.adminForm.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-6 space-y-4 border hairline bg-white p-5">
          <h2 className="font-display text-2xl">{editing.id ? t.adminCatalog.editCategory : t.adminCatalog.newCategory}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.adminForm.name} required>
              <Input value={editing.name ?? ""} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required />
            </Field>
            <Field label={t.adminCatalog.slugAuto}>
              <Input value={editing.slug ?? ""} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.adminCatalog.parent}>
              <Select
                value={editing.parentId ?? ""}
                onChange={(event) => setEditing({ ...editing, parentId: event.target.value || null })}
              >
                <option value="">{t.adminCatalog.topLevel}</option>
                {categories
                  .filter((category) => category.id !== editing.id && !category.parentId)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t.adminForm.sortOrder}>
              <Input type="number" min={0} value={editing.sortOrder ?? 0} onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) || 0 })} />
            </Field>
          </div>
          <Field label={t.adminForm.description}>
            <Textarea value={editing.description ?? ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} rows={2} />
          </Field>
          <Field label={t.adminCatalog.imageUrl}>
            <Input value={editing.image ?? ""} onChange={(event) => setEditing({ ...editing, image: event.target.value })} placeholder="https://…" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.isActive ?? true} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} className="h-4 w-4 accent-[#1c1a17]" />
            {t.adminCatalog.activeVisible}
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} size="sm">
              {pending ? t.adminForm.saving : t.adminCatalog.saveCategory}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
              {t.adminForm.cancel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
