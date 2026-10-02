import type { Metadata } from "next";
import Link from "next/link";
import { getWishlistItems } from "@/server/actions/account";
import { WishlistList } from "../account/wishlist/wishlist-list";
import { GuestWishlist } from "./guest-wishlist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const items = await getWishlistItems().catch(() => null);

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">Saved pieces</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Wishlist</h1>
        {!items && (
          <p className="mt-3 text-ink-soft">
            <Link href="/login" className="underline underline-offset-2">
              Sign in
            </Link>{" "}
            to sync your wishlist across devices.
          </p>
        )}
      </div>
      {items ? <WishlistList initial={items} /> : <GuestWishlist />}
    </div>
  );
}
