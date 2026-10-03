"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui";

const STORAGE_KEY = "nur-cookie-consent";

/**
 * No banner, no interruption: analytics default to OFF and the visitor can
 * change their mind anytime through the footer's cookie preferences.
 */
export function CookiePreferences() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener("nur-open-consent", reopen);
    return () => window.removeEventListener("nur-open-consent", reopen);
  }, []);

  function choose(value: "accepted" | "rejected") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // storage unavailable — choice simply doesn't persist
    }
    setOpen(false);
    window.dispatchEvent(new Event("nur-consent"));
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Cookie preferences">
      <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
        We use strictly essential cookies for your bag and security — the store
        cannot work without them. With your permission we also use analytics
        cookies to understand visits and improve the boutique.         Read our{" "}
        <Link href="/pages/cookies" className="underline underline-offset-2">
          cookie policy
        </Link>
        .
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => choose("rejected")} className="btn btn-ghost flex-1">
          Essential only
        </button>
        <button type="button" onClick={() => choose("accepted")} className="btn btn-primary flex-1">
          Accept analytics
        </button>
      </div>
    </Modal>
  );
}

export function openCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("nur-open-consent"));
  }
}
