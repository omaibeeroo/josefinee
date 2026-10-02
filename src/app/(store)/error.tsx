"use client";

import Link from "next/link";

export default function StoreError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-luxe py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 font-display text-4xl">Please try again</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        An unexpected error occurred. Your bag is safe — try reloading this page.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={() => reset()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Back to home
        </Link>
      </div>
    </div>
  );
}
