import type { Metadata } from "next";
import Link from "next/link";
import { getWishlistItems } from "@/server/actions/account";
import { getDictionary } from "@/lib/i18n/server";
import { WishlistList } from "../account/wishlist/wishlist-list";
import { GuestWishlist } from "./guest-wishlist";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.wishlist.title, robots: { index: false, follow: false } };
}

export default async function WishlistPage() {
  const [items, t] = await Promise.all([getWishlistItems().catch(() => null), getDictionary()]);

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">{t.account.savedPieces}</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">{t.wishlist.title}</h1>
        {!items && (
          <p className="mt-3 text-ink-soft">
            <Link href="/login" className="underline underline-offset-2">
              {t.account.signInSync}
            </Link>{" "}
            {t.account.syncHint}
          </p>
        )}
      </div>
      {items ? <WishlistList initial={items} /> : <GuestWishlist />}
    </div>
  );
}
