"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/provider";

export default function StoreError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="container-luxe py-24 text-center">
      <p className="eyebrow">{t.errors.title}</p>
      <h1 className="mt-3 font-display text-4xl">{t.errors.heading}</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        {t.errors.message}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={() => reset()} className="btn btn-primary">
          {t.errors.tryAgain}
        </button>
        <Link href="/" className="btn btn-ghost">
          {t.common.backHome}
        </Link>
      </div>
    </div>
  );
}
