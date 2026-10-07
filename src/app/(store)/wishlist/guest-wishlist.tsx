"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/storefront/cart-ui";
import { getWishlistProductsAction } from "@/server/actions/engagement";
import { readGuestWishlist } from "@/components/storefront/product";
import { Button, Price } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
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
  const { t } = useLocale();
  const router = useRouter();
  const { add } = useCart();
  const [items, setItems] = useState<GuestWishlistRow[] | null>(null);
  const [movingProductIds, setMovingProductIds] = useState<string[]>([]);
  const [moveErrors, setMoveErrors] = useState<Record<string, string>>({});

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
    window.addEventListener("hanadi-wishlist", onChange);
    return () => window.removeEventListener("hanadi-wishlist", onChange);
  }, [load]);

  function remove(productId: string) {
    try {
      const ids = readGuestWishlist().filter((id) => id !== productId);
      window.localStorage.setItem("hanadi-wishlist", JSON.stringify(ids));
      window.dispatchEvent(new Event("hanadi-wishlist"));
    } catch {
      setItems((previous) => previous?.filter((item) => item.productId !== productId) ?? previous);
    }
    router.refresh();
  }

  async function moveToBag(item: GuestWishlistRow) {
    if (!item.defaultVariantId || movingProductIds.includes(item.productId)) return;
    setMovingProductIds((current) => [...current, item.productId]);
    setMoveErrors((current) => ({ ...current, [item.productId]: "" }));
    try {
      const result = await add(item.defaultVariantId, 1);
      if (result.ok) remove(item.productId);
      else setMoveErrors((current) => ({ ...current, [item.productId]: result.error || t.wishlist.addFailed }));
    } catch {
      setMoveErrors((current) => ({ ...current, [item.productId]: t.wishlist.addFailed }));
    } finally {
      setMovingProductIds((current) => current.filter((productId) => productId !== item.productId));
    }
  }

  if (items === null) {
    return <p className="py-10 text-center text-ink-soft">{t.account.loadingWishlist}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-display text-2xl">{t.account.savedEmpty}</p>
        <p className="mt-2 text-ink-soft">
          {t.account.savedHintSync}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/shop" className="btn btn-primary">
            {t.common.discoverShop}
          </Link>
          <Link href="/login" className="btn btn-ghost">
            {t.auth.signIn}
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
              <button type="button" aria-label={`${t.cart.removeItem} ${item.name}`} onClick={() => remove(item.productId)} className="p-1 text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <div className="mt-1">
              <Price price={item.price} compareAt={item.compareAtPrice} />
            </div>
          <div className="mt-auto pt-2">
              {item.inStock && item.defaultVariantId ? (
                <Button size="sm" variant="outline" disabled={movingProductIds.includes(item.productId)} onClick={() => void moveToBag(item)}>
                  {movingProductIds.includes(item.productId) ? t.product.adding : t.product.addToBag}
                </Button>
              ) : (
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">{t.product.soldOut}</p>
              )}
              {moveErrors[item.productId] && <p className="mt-2 text-xs text-sale" role="alert">{moveErrors[item.productId]}</p>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
