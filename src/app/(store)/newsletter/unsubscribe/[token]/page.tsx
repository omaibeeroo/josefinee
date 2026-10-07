import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n/server";
import { UnsubscribeForm } from "./unsubscribe-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.unsubscribe.title, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const validFormat = /^[A-Za-z0-9_-]{16,128}$/.test(token);
  const subscriber = validFormat
    ? await prisma.newsletterSubscriber.findUnique({
        where: { unsubscribeToken: token },
        select: { unsubscribedAt: true },
      })
    : null;
  const active = Boolean(subscriber && !subscriber.unsubscribedAt);
  const t = await getDictionary();

  return (
    <div className="container-luxe max-w-xl py-16 text-center">
      <h1 className="font-display text-4xl">{t.unsubscribe.heading}</h1>
      <p className="mt-3 text-ink-soft">
        {active
          ? t.unsubscribe.confirm
          : subscriber
            ? t.unsubscribe.already
            : t.unsubscribe.invalid}
      </p>
      {active && <UnsubscribeForm token={token} />}
      <Link href="/" className="btn btn-primary mt-8">
        {t.common.backHome}
      </Link>
    </div>
  );
}
