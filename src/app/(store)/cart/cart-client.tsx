"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearCartAction, removeCartItemAction, updateCartItemAction } from "@/server/actions/cart";
import { useCart } from "@/components/storefront/cart-ui";
import { EmptyState, QuantitySelector } from "@/components/ui";
import { formatDA } from "@/lib/money";
import { Trash2 } from "lucide-react";

export function CartLines() {
  const { items, subtotal, refresh } = useCart();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function changeQuantity(itemId: string, quantity: number) {
    setPending(itemId);
    await updateCartItemAction(itemId, quantity);
    await refresh();
    setPending(null);
  }

  async function remove(itemId: string) {
    setPending(itemId);
    await removeCartItemAction(itemId);
    await refresh();
    router.refresh();
    setPending(null);
  }

  async function clear() {
    setPending("clear");
    await clearCartAction();
    await refresh();
    router.refresh();
    setPending(null);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your bag is empty"
        message="Beautiful pieces are waiting for you."
        action={
          <Link href="/shop" className="btn btn-primary">
            Start shopping
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <ul className="divide-y divide-line border-y hairline">
        {items.map((item) => (
          <li key={item.id} className="flex gap-4 py-5 md:gap-6">
            <Link
              href={`/products/${item.productSlug}`}
              className="relative h-32 w-24 shrink-0 overflow-hidden bg-cream md:h-40 md:w-32"
            >
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.productName} fill sizes="128px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-3xl text-ink-muted">
                  {item.productName.charAt(0)}
                </span>
              )}
            </Link>
            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/products/${item.productSlug}`} className="font-medium hover:underline">
                    {item.productName}
                  </Link>
                  {item.variantLabel && <p className="mt-0.5 text-sm text-ink-muted">{item.variantLabel}</p>}
                  <p className="mt-1 text-sm text-ink-soft">{formatDA(item.unitPrice)} each</p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${item.productName}`}
                  disabled={pending === item.id}
                  onClick={() => void remove(item.id)}
                  className="p-1 text-ink-muted hover:text-ink disabled:opacity-40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between pt-3">
                <QuantitySelector
                  value={item.quantity}
                  max={Math.min(20, Math.max(item.available, item.quantity))}
                  onChange={(quantity) => void changeQuantity(item.id, quantity)}
                />
                <p className="font-medium">{formatDA(item.lineTotal)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="border hairline bg-white p-6">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em]">Order summary</h2>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-ink-soft">Subtotal</span>
            <span className="font-medium">{formatDA(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Delivery calculated at checkout. Cash on delivery.</p>
          <Link href="/checkout" className="btn btn-primary mt-5 w-full">
            Checkout
          </Link>
          <div className="mt-2 flex justify-between">
            <Link href="/shop" className="btn btn-ghost flex-1">
              Continue shopping
            </Link>
            <button
              type="button"
              onClick={() => void clear()}
              disabled={pending === "clear"}
              className="ml-2 px-2 text-xs uppercase tracking-[0.14em] text-ink-muted underline underline-offset-2 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
