"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import {
  getVitrineData,
  moveCollectionProduct,
  saveAnnouncementScheduleAction,
  saveHomepageDisplayAction,
  saveVitrineSections,
  setSpotlightProduct,
} from "@/server/actions/vitrine";
import type { HomepageSectionId } from "@/lib/settings";

type VitrineData = Awaited<ReturnType<typeof getVitrineData>>;

export function VitrineManager({ data }: { data: VitrineData }) {
  const router = useRouter();
  const { t } = useLocale();
  const [sections, setSections] = useState(data.sections);
  const [spotlight, setSpotlight] = useState<string | null>(data.spotlightProductId);
  const [collectionId, setCollectionId] = useState(data.collections[0]?.id ?? "");
  const [display, setDisplay] = useState({
    featuredCount: data.display.featuredCount,
    bestSellersCount: data.display.bestSellersCount,
    newInCount: data.display.newInCount,
    categoryCount: data.display.categoryCount,
    catalogPageSize: data.catalogPageSize,
  });
  const [schedStart, setSchedStart] = useState(data.announcement.startsAt?.slice(0, 16) ?? "");
  const [schedEnd, setSchedEnd] = useState(data.announcement.endsAt?.slice(0, 16) ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const collection = data.collections.find((entry) => entry.id === collectionId) ?? null;

  function moveSection(index: number, direction: -1 | 1) {
    const next = [...sections];
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= next.length) return;
    const current = next[index]!;
    next[index] = next[swapWith]!;
    next[swapWith] = current;
    setSections(next);
  }

  function toggleSection(id: HomepageSectionId) {
    setSections((previous) =>
      previous.map((entry) => (entry.id === id ? { ...entry, visible: !entry.visible } : entry)),
    );
  }

  async function saveSections() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveVitrineSections(sections);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? t.actions.wentWrong);
      return;
    }
    setMessage(t.adminVitrine.saved);
    router.refresh();
  }

  async function saveSpotlight() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await setSpotlightProduct(spotlight);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? t.actions.wentWrong);
      return;
    }
    setMessage(t.adminVitrine.saved);
    router.refresh();
  }

  async function saveDisplay() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveHomepageDisplayAction({
      featuredCount: Number(display.featuredCount) || 0,
      bestSellersCount: Number(display.bestSellersCount) || 0,
      newInCount: Number(display.newInCount) || 0,
      categoryCount: Number(display.categoryCount) || 0,
      catalogPageSize: Number(display.catalogPageSize) || 0,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? t.actions.wentWrong);
      return;
    }
    setMessage(t.adminVitrine.saved);
    router.refresh();
  }

  /** datetime-local gives "YYYY-MM-DDTHH:mm" (no offset); the server parses it. */
  async function saveSchedule() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveAnnouncementScheduleAction({ startsAt: schedStart, endsAt: schedEnd });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? t.actions.wentWrong);
      return;
    }
    setMessage(t.adminVitrine.saved);
    router.refresh();
  }

  async function moveProduct(productId: string, direction: "up" | "down") {
    if (!collection) return;
    setError(null);
    const result = await moveCollectionProduct({
      collectionId: collection.id,
      productId,
      direction,
    });
    if (!result.ok) setError(result.error ?? t.actions.wentWrong);
    router.refresh();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="border hairline bg-white p-5" aria-label={t.adminVitrine.sections}>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">
          {t.adminVitrine.sections}
        </h2>
        <ul className="divide-y divide-line border-y hairline">
          {sections.map((entry, index) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={entry.visible}
                  onChange={() => toggleSection(entry.id)}
                  className="h-4 w-4 shrink-0 accent-[#1c1a17]"
                />
                <span className={cn("truncate text-sm", !entry.visible && "text-ink-muted line-through")}>
                  {t.adminVitrine.names[entry.id] ?? entry.id}
                </span>
              </label>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, -1)}
                  disabled={index === 0}
                  aria-label={t.adminVitrine.moveUp}
                  className="p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 1)}
                  disabled={index === sections.length - 1}
                  aria-label={t.adminVitrine.moveDown}
                  className="p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <Button type="button" size="sm" disabled={pending} onClick={() => void saveSections()} className="mt-4">
          {pending ? "…" : t.adminVitrine.saveSections}
        </Button>
        {message && (
          <p className="mt-2 text-sm text-ink-soft" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-[#9e342e]" role="alert">
            {error}
          </p>
        )}
      </section>

      <div className="space-y-4">
        <section className="border hairline bg-white p-5" aria-label={t.adminVitrine.spotlight}>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">
            {t.adminVitrine.spotlight}
          </h2>
          <select
            value={spotlight ?? ""}
            onChange={(event) => setSpotlight(event.target.value || null)}
            className="field"
            aria-label={t.adminVitrine.spotlight}
          >
            <option value="">{t.adminVitrine.autoSpotlight}</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} — {product.price} DA
              </option>
            ))}
          </select>
          <Button type="button" size="sm" disabled={pending} onClick={() => void saveSpotlight()} className="mt-3">
            {pending ? "…" : t.adminVitrine.saveSpotlight}
          </Button>
        </section>

        <section className="border hairline bg-white p-5" aria-label={t.adminVitrine.displayTitle}>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">
            {t.adminVitrine.displayTitle}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-ink-muted">{t.adminVitrine.featuredCount}</span>
              <input
                type="number"
                min={2}
                max={24}
                value={display.featuredCount}
                onChange={(event) => setDisplay({ ...display, featuredCount: Number(event.target.value) })}
                className="field min-h-10"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-ink-muted">{t.adminVitrine.bestSellersCount}</span>
              <input
                type="number"
                min={2}
                max={24}
                value={display.bestSellersCount}
                onChange={(event) => setDisplay({ ...display, bestSellersCount: Number(event.target.value) })}
                className="field min-h-10"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-ink-muted">{t.adminVitrine.newInCount}</span>
              <input
                type="number"
                min={2}
                max={24}
                value={display.newInCount}
                onChange={(event) => setDisplay({ ...display, newInCount: Number(event.target.value) })}
                className="field min-h-10"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-ink-muted">{t.adminVitrine.categoryCount}</span>
              <input
                type="number"
                min={2}
                max={12}
                value={display.categoryCount}
                onChange={(event) => setDisplay({ ...display, categoryCount: Number(event.target.value) })}
                className="field min-h-10"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs text-ink-muted">{t.adminVitrine.catalogPageSize}</span>
              <input
                type="number"
                min={6}
                max={48}
                step={6}
                value={display.catalogPageSize}
                onChange={(event) => setDisplay({ ...display, catalogPageSize: Number(event.target.value) })}
                className="field min-h-10"
              />
            </label>
          </div>
          <Button type="button" size="sm" disabled={pending} onClick={() => void saveDisplay()} className="mt-3">
            {pending ? "…" : t.adminVitrine.saveDisplay}
          </Button>
        </section>

        <section className="border hairline bg-white p-5" aria-label={t.adminVitrine.schedTitle}>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">
            {t.adminVitrine.schedTitle}
          </h2>
          <p className="mb-3 text-xs text-ink-muted">{t.adminVitrine.schedHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-ink-muted">{t.adminVitrine.schedStart}</span>
              <input
                type="datetime-local"
                value={schedStart}
                onChange={(event) => setSchedStart(event.target.value)}
                className="field min-h-10"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-ink-muted">{t.adminVitrine.schedEnd}</span>
              <input
                type="datetime-local"
                value={schedEnd}
                onChange={(event) => setSchedEnd(event.target.value)}
                className="field min-h-10"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => void saveSchedule()}>
              {pending ? "…" : t.adminVitrine.saveSchedule}
            </Button>
            {(schedStart || schedEnd) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setSchedStart("");
                  setSchedEnd("");
                }}
              >
                {t.adminVitrine.schedClear}
              </Button>
            )}
          </div>
        </section>

        <section className="border hairline bg-white p-5" aria-label={t.adminVitrine.collectionOrder}>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">
            {t.adminVitrine.collectionOrder}
          </h2>
          <select
            value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)}
            className="field"
            aria-label={t.adminVitrine.collectionOrder}
          >
            <option value="">{t.adminVitrine.chooseCollection}</option>
            {data.collections.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} ({entry.products.length})
              </option>
            ))}
          </select>
          {collection && (
            <ul className="mt-3 divide-y divide-line border-y hairline">
              {collection.products.length === 0 && (
                <li className="py-3 text-sm text-ink-muted">{t.adminVitrine.noProducts}</li>
              )}
              {collection.products.map((link, index) => (
                <li key={link.product.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="me-2 text-xs tabular-nums text-ink-muted">{index + 1}</span>
                    {link.product.name}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void moveProduct(link.product.id, "up")}
                      disabled={index === 0}
                      aria-label={t.adminVitrine.moveUp}
                      className="p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveProduct(link.product.id, "down")}
                      disabled={index === collection.products.length - 1}
                      aria-label={t.adminVitrine.moveDown}
                      className="p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
