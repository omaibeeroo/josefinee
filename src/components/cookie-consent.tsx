"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";

const STORAGE_KEY = "hanadi-cookie-consent";

/**
 * No banner, no interruption: analytics default to OFF and the visitor can
 * change their mind anytime through the footer's cookie preferences.
 */
export function CookiePreferences() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener("hanadi-open-consent", reopen);
    return () => window.removeEventListener("hanadi-open-consent", reopen);
  }, []);

  function choose(value: "accepted" | "rejected") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // storage unavailable — choice simply doesn't persist
    }
    setOpen(false);
    window.dispatchEvent(new Event("hanadi-consent"));
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t.cookies.title}>
      <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
        {t.cookies.text}{" "}
        <Link href="/pages/cookies" className="underline underline-offset-2">
          {t.cookies.policy}
        </Link>
        .
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => choose("rejected")} className="btn btn-ghost flex-1">
          {t.cookies.essential}
        </button>
        <button type="button" onClick={() => choose("accepted")} className="btn btn-primary flex-1">
          {t.cookies.accept}
        </button>
      </div>
    </Modal>
  );
}

export function openCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("hanadi-open-consent"));
  }
}
