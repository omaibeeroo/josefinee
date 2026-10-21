"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui";
import { COOKIE_CONSENT_STORAGE_KEY, type CookieConsent } from "@/components/pixel-consent";
import { useLocale } from "@/lib/i18n/provider";

export type { CookieConsent } from "@/components/pixel-consent";

/**
 * Analytics default to OFF. The first visit gets a non-blocking choice, and
 * the footer keeps the same settings available on every page afterwards.
 */
export function CookiePreferences() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState<CookieConsent | null | undefined>(undefined);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      setConsent(stored === "accepted" || stored === "rejected" ? stored : null);
    } catch {
      // A storage failure is privacy-safe: keep analytics disabled and show
      // the choice again on the next visit.
      setConsent(null);
    }
    const reopen = () => setOpen(true);
    window.addEventListener("hanadi-open-consent", reopen);
    return () => window.removeEventListener("hanadi-open-consent", reopen);
  }, []);

  function choose(value: CookieConsent) {
    setConsent(value);
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
    } catch {
      // storage unavailable — choice simply doesn't persist
    }
    setOpen(false);
    window.dispatchEvent(new Event("hanadi-consent"));
  }

  const copy = (
    <p className="text-[0.9375rem] leading-relaxed text-ink-soft" dir="auto">
      {t.cookies.text}{" "}
      <Link href="/pages/cookies" className="underline underline-offset-2">
        {t.cookies.policy}
      </Link>
      .
    </p>
  );
  const actions = (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={() => choose("rejected")}
        className="btn btn-outline min-h-11 flex-1"
      >
        {t.cookies.reject}
      </button>
      <button
        type="button"
        onClick={() => choose("accepted")}
        className="btn btn-outline min-h-11 flex-1"
      >
        {t.cookies.accept}
      </button>
    </div>
  );

  return (
    <>
      {consent === null && !open && (
        <section
          className="cookie-consent-banner fixed inset-x-3 bottom-3 z-[65] mx-auto max-w-2xl border hairline bg-ivory p-4 shadow-card sm:inset-x-6 sm:bottom-6 sm:p-6"
          aria-labelledby="cookie-consent-heading"
          aria-live="polite"
          dir="auto"
        >
          <h2 id="cookie-consent-heading" className="font-display text-xl">
            {t.cookies.title}
          </h2>
          <div className="mt-2">{copy}</div>
          {actions}
        </section>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={t.cookies.title}>
        {copy}
        {actions}
      </Modal>
    </>
  );
}

export function openCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("hanadi-open-consent"));
  }
}
