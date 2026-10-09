"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/server/actions/locale";
import { useLocale } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<Locale, string> = { fr: "FR", en: "EN", ar: "عربي" };

export function LocaleToggle({ className }: { className?: string }) {
  const { locale } = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function switchTo(next: Locale) {
    if (next === locale || pending) return;
    setPending(true);
    await setLocaleAction(next).catch(() => undefined);
    setPending(false);
    router.refresh();
  }

  return (
    <div
      className={cn("flex items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.18em]", className)}
      role="group"
      aria-label="Langue / Language / اللغة"
    >
      {(Object.keys(LOCALE_LABELS) as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          onClick={() => void switchTo(code)}
          aria-pressed={locale === code}
          className={cn(
            "underline-offset-4 disabled:opacity-50",
            locale === code ? "text-ink underline" : "text-ink-muted hover:text-ink",
          )}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
