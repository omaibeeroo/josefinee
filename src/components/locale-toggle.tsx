"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/provider";
import { LOCALE_COOKIE, localeDir, type Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<Locale, string> = { fr: "FR", en: "EN", ar: "عربي" };
const LOCALE_ORDER: Locale[] = ["fr", "en", "ar"];

export function LocaleToggle({
  className,
  variant = "full",
}: {
  className?: string;
  /** "cycle" shows one compact button that rotates through locales — for tight mobile headers. */
  variant?: "full" | "cycle";
}) {
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const pending = isRefreshing;

  function switchTo(next: Locale) {
    if (next === locale || pending) return;
    // Update client-rendered copy and direction immediately; only server-rendered
    // content waits for the router refresh below.
    setLocale(next);
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${365 * 86_400}; samesite=lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = localeDir(next);
    } catch {
      // storage/DOM unavailable — the refresh below still applies the locale.
    }
    startRefresh(() => {
      router.refresh();
    });
  }

  if (variant === "cycle") {
    const next = LOCALE_ORDER[(LOCALE_ORDER.indexOf(locale) + 1) % LOCALE_ORDER.length]!;
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => void switchTo(next)}
        title={LOCALE_LABELS[next]}
        aria-label={`Langue / Language / اللغة — ${LOCALE_LABELS[next]}`}
        className={cn(
          "flex min-h-11 min-w-11 shrink-0 items-center justify-center px-2 text-[0.62rem] font-medium uppercase tracking-[0.08em] text-ink underline underline-offset-4 disabled:opacity-50",
          className,
        )}
      >
        {LOCALE_LABELS[locale]}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.18em]",
        className,
      )}
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
            "flex h-11 w-11 shrink-0 items-center justify-center text-center whitespace-nowrap underline-offset-4 disabled:opacity-50",
            locale === code ? "text-ink underline" : "text-ink-muted hover:text-ink",
          )}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
