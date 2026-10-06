"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/storefront/cart-ui";
import { toggleWishlistAction } from "@/server/actions/engagement";
import { Button, Price } from "@/components/ui";
import { ProductImage } from "@/components/storefront/product";
import { X } from "lucide-react";

export type WishlistRow = {
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

export function WishlistList({ initial }: { initial: WishlistRow[] }) {
  const router = useRouter();
  const { add } = useCart();
  const [items, setItems] = useState(initial);

  async function remove(productId: string) {
    await toggleWishlistAction(productId);
    setItems((previous) => previous.filter((item) => item.productId !== productId));
    router.refresh();
  }

  async function moveToBag(item: WishlistRow) {
    if (!item.defaultVariantId) return;
    const result = await add(item.defaultVariantId, 1);
    if (result.ok) await remove(item.productId);
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-display text-2xl">Rien de sauvegardé pour l’instant</p>
        <p className="mt-2 text-ink-soft">Touchez le cœur sur un article pour le garder ici.</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Découvrir nos pièces
        </Link>
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
              <button type="button" aria-label={`Retirer ${item.name}`} onClick={() => void remove(item.productId)} className="p-1 text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <div className="mt-1">
              <Price price={item.price} compareAt={item.compareAtPrice} />
            </div>
            <div className="mt-auto pt-2">
              {item.inStock && item.defaultVariantId ? (
                <Button size="sm" variant="outline" onClick={() => void moveToBag(item)}>
                  Ajouter au panier
                </Button>
              ) : (
                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Épuisé</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
