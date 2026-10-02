"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/storefront/cart-ui";
import { getWishlistProductsAction } from "@/server/actions/engagement";
import { readGuestWishlist } from "@/components/storefront/product";
import { Button, Price } from "@/components/ui";
import { ProductImage } from "@/components/storefront/product";
import { X } from "lucide-react";

export type GuestWishlistRow = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  inStock: boolean;
  defaultVariantId: string | null;
};

export function GuestWishlist() {
  const router = useRouter();
  const { add } = useCart();
  const [items, setItems] = useState<GuestWishlistRow[] | null>(null);

  const load = useCallback(async () => {
    const ids = readGuestWishlist();
    if (ids.length === 0) {
      setItems([]);
      return;
    }
    setItems(await getWishlistProductsAction(ids));
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("nur-wishlist", onChange);
    return () => window.removeEventListener("nur-wishlist", onChange);
  }, [load]);

  function remove(productId: string) {
    try {
      const ids = readGuestWishlist().filter((id) => id !== productId);
      window.localStorage.setItem("nur-wishlist", JSON.stringify(ids));
      window.dispatchEvent(new Event("nur-wishlist"));
    } catch {
      setItems((previous) => previous?.filter((item) => item.productId !== productId) ?? previous);
    }
    router.refresh();
  }

  async function moveToBag(item: GuestWishlistRow) {
    if (!item.defaultVariantId) return;
    const result = await add(item.defaultVariantId, 1);
    if (result.ok) remove(item.productId);
  }

  if (items === null) {
    return <p className="py-10 text-center text-ink-soft">Loading your wishlist…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-display text-2xl">Nothing saved yet</p>
        <p className="mt-2 text-ink-soft">
          Tap the heart on any product to keep it here — sign in to sync it across devices.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/shop" className="btn btn-primary">
            Discover pieces
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="flex gap-4 border hairline bg-white p-4">
          <Link href={`/products/${item.slug}`} className="relative h-28 w-24 shrink-0 overflow-hidden bg-cream">
            <ProductImage url={item.image} alt={item.name} sizes="96px" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/products/${item.slug}`} className="text-sm font-medium hover:underline">
                {item.name}
              </Link>
              <button type="button" aria-label={`Remove ${item.name}`} onClick={() => remove(item.productId)} className="p-1 text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <div className="mt-1">
              <Price price={item.price} compareAt={item.compareAtPrice} />
            </div>
            <div className="mt-auto pt-2">
              {item.inStock && item.defaultVariantId ? (
                <Button size="sm" variant="outline" onClick={() => void moveToBag(item)}>
                  Move to bag
                </Button>
              ) : (
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Out of stock</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
