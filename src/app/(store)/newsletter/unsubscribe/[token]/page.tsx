import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeAction } from "@/server/actions/engagement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await unsubscribeAction(token);

  return (
    <div className="container-luxe max-w-xl py-16 text-center">
      <h1 className="font-display text-4xl">
        {result.ok ? "You are unsubscribed" : "Link not valid"}
      </h1>
      <p className="mt-3 text-ink-soft">
        {result.ok
          ? "You will no longer receive our newsletter. You can resubscribe anytime."
          : "This unsubscribe link is not valid or already used."}
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Back to home
      </Link>
    </div>
  );
}
