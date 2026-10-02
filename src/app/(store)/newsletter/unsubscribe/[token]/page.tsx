import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UnsubscribeForm } from "./unsubscribe-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Désinscription",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

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

  return (
    <div className="container-luxe max-w-xl py-16 text-center">
      <h1 className="font-display text-4xl">Désinscription à la newsletter</h1>
      <p className="mt-3 text-ink-soft">
        {active
          ? "Confirmez votre choix pour ne plus recevoir nos actualités."
          : subscriber
            ? "Cette adresse est déjà désinscrite de notre newsletter."
            : "Ce lien n’est pas valide ou n’est plus disponible."}
      </p>
      {active && <UnsubscribeForm token={token} />}
      <Link href="/" className="btn btn-primary mt-8">
        Retour à l’accueil
      </Link>
    </div>
  );
}
