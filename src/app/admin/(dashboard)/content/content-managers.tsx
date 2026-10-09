"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAnnouncementAction,
  deleteFaqAction,
  saveAnnouncementAction,
  saveFaqAction,
  savePageAction,
} from "@/server/actions/admin-ops";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";

export type CmsPageRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type FaqRow = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
};

export type AnnouncementRow = {
  id: string;
  text: string;
  href: string | null;
  isActive: boolean;
  sortOrder: number;
};

export function PagesManager({ pages }: { pages: CmsPageRow[] }) {
  const router = useRouter();
  const { t } = useLocale();
  const [editing, setEditing] = useState<Partial<CmsPageRow> & { id?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const result = await savePageAction({
      id: editing.id,
      slug: editing.slug ?? "",
      title: editing.title ?? "",
      content: editing.content ?? "",
      isPublished: editing.isPublished ?? true,
      seoTitle: editing.seoTitle ?? undefined,
      seoDescription: editing.seoDescription ?? undefined,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  return (
    <section aria-label={t.adminContent.pages}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-2xl">{t.adminContent.pages}</h2>
      </div>
      {error && (
        <p className="mb-3 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[560px] text-start text-sm">
          <tbody className="divide-y divide-line">
            {pages.map((page) => (
              <tr key={page.id}>
                <td className="px-4 py-3 font-medium">
                  {page.title}
                  <span className="block text-xs font-normal text-ink-muted">/pages/{page.slug}</span>
                </td>
                <td className="px-4 py-3 text-xs">{page.isPublished ? t.adminContent.published : t.adminContent.hidden}</td>
                <td className="px-4 py-3 text-end text-xs">
                  <button type="button" onClick={() => setEditing({ ...page })} className="underline underline-offset-2">
                    {t.adminForm.edit}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <form onSubmit={submit} className="mt-4 space-y-4 border hairline bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.adminContent.pageTitle} required>
              <Input value={editing.title ?? ""} onChange={(event) => setEditing({ ...editing, title: event.target.value })} required />
            </Field>
            <Field label={t.adminForm.slug} required>
              <Input value={editing.slug ?? ""} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} required />
            </Field>
          </div>
          <Field label={t.adminContent.contentHtml}>
            <Textarea value={editing.content ?? ""} onChange={(event) => setEditing({ ...editing, content: event.target.value })} rows={8} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.adminContent.seoTitle}>
              <Input value={editing.seoTitle ?? ""} onChange={(event) => setEditing({ ...editing, seoTitle: event.target.value })} />
            </Field>
            <Field label={t.adminContent.seoDescription}>
              <Input value={editing.seoDescription ?? ""} onChange={(event) => setEditing({ ...editing, seoDescription: event.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.isPublished ?? true} onChange={(event) => setEditing({ ...editing, isPublished: event.target.checked })} className="h-4 w-4 accent-[#1c1a17]" />
            {t.adminContent.publishedLabel}
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm">{t.adminContent.savePage}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>{t.adminForm.cancel}</Button>
          </div>
        </form>
      )}
    </section>
  );
}

export function FaqManager({ items }: { items: FaqRow[] }) {
  const router = useRouter();
  const { t } = useLocale();
  const [editing, setEditing] = useState<Partial<FaqRow> & { id?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const result = await saveFaqAction({
      id: editing.id,
      category: editing.category ?? "",
      question: editing.question ?? "",
      answer: editing.answer ?? "",
      sortOrder: editing.sortOrder ?? 0,
      isPublished: editing.isPublished ?? true,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  return (
    <section aria-label={t.adminContent.faq}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-2xl">{t.adminContent.faq}</h2>
        <Button size="sm" onClick={() => setEditing({ category: "Ordering", question: "", answer: "", sortOrder: items.length, isPublished: true })}>
          {t.adminContent.newQuestion}
        </Button>
      </div>
      {error && (
        <p className="mb-3 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 border hairline bg-white p-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{item.category}</p>
              <p className="font-medium">{item.question}</p>
              {!item.isPublished && <p className="text-xs text-ink-muted">{t.adminContent.hidden}</p>}
            </div>
            <div className="flex shrink-0 gap-2 text-xs">
              <button type="button" onClick={() => setEditing({ ...item })} className="underline underline-offset-2">
                {t.adminForm.edit}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t.adminContent.deleteQuestion)) void deleteFaqAction(item.id).then(() => router.refresh());
                }}
                className="text-[#9e342e] underline underline-offset-2"
              >
                {t.adminForm.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <form onSubmit={submit} className="mt-4 space-y-4 border hairline bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.adminContent.category} required>
              <Select value={editing.category ?? ""} onChange={(event) => setEditing({ ...editing, category: event.target.value })}>
                {["Ordering", "Delivery", "COD", "Products", "Returns", "Exchanges", "Care"].map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.adminForm.sortOrder}>
              <Input type="number" min={0} value={editing.sortOrder ?? 0} onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) || 0 })} />
            </Field>
          </div>
          <Field label={t.adminContent.question} required>
            <Input value={editing.question ?? ""} onChange={(event) => setEditing({ ...editing, question: event.target.value })} required />
          </Field>
          <Field label={t.adminContent.answer} required>
            <Textarea value={editing.answer ?? ""} onChange={(event) => setEditing({ ...editing, answer: event.target.value })} rows={4} required />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.isPublished ?? true} onChange={(event) => setEditing({ ...editing, isPublished: event.target.checked })} className="h-4 w-4 accent-[#1c1a17]" />
            {t.adminContent.publishedLabel}
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm">{t.adminForm.save}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>{t.adminForm.cancel}</Button>
          </div>
        </form>
      )}
    </section>
  );
}

export function AnnouncementsManager({ items }: { items: AnnouncementRow[] }) {
  const router = useRouter();
  const { t } = useLocale();
  const [editing, setEditing] = useState<Partial<AnnouncementRow> & { id?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const result = await saveAnnouncementAction({
      id: editing.id,
      text: editing.text ?? "",
      href: editing.href ?? undefined,
      isActive: editing.isActive ?? true,
      sortOrder: editing.sortOrder ?? 0,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  return (
    <section aria-label={t.adminContent.announcements}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-2xl">{t.adminContent.announcements}</h2>
        <Button size="sm" onClick={() => setEditing({ text: "", href: "", isActive: true, sortOrder: items.length })}>
          {t.adminContent.newAnnouncement}
        </Button>
      </div>
      {error && (
        <p className="mb-3 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 border hairline bg-white p-4 text-sm">
            <div>
              <p className="font-medium">{item.text}</p>
              <p className="text-xs text-ink-muted">
                {item.href || t.adminContent.noLink} · {item.isActive ? t.adminForm.active : t.adminContent.hidden}
              </p>
            </div>
            <div className="flex shrink-0 gap-2 text-xs">
              <button type="button" onClick={() => setEditing({ ...item })} className="underline underline-offset-2">
                {t.adminForm.edit}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t.adminContent.deleteAnnouncement)) void deleteAnnouncementAction(item.id).then(() => router.refresh());
                }}
                className="text-[#9e342e] underline underline-offset-2"
              >
                {t.adminForm.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <form onSubmit={submit} className="mt-4 space-y-4 border hairline bg-white p-5">
          <Field label={t.adminContent.text} required>
            <Input value={editing.text ?? ""} onChange={(event) => setEditing({ ...editing, text: event.target.value })} required maxLength={200} />
          </Field>
          <Field label={t.adminContent.link}>
            <Input value={editing.href ?? ""} onChange={(event) => setEditing({ ...editing, href: event.target.value })} placeholder="/collections/new-in" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.isActive ?? true} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} className="h-4 w-4 accent-[#1c1a17]" />
            {t.adminForm.active}
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm">{t.adminForm.save}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>{t.adminForm.cancel}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
