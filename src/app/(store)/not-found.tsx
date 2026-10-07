import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getDictionary();
  return (
    <div className="container-luxe py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-display text-5xl">{t.errors.notFoundTitle}</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        {t.errors.notFoundHint}
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        {t.common.backHome}
      </Link>
    </div>
  );
}
