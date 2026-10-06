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

export function CartLines({ floor }: { floor: { minHome: number } | null }) {
  const { items, subtotal, refresh } = useCart();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeQuantity(itemId: string, quantity: number) {
    setPending(itemId);
    setError(null);
    try {
      const result = await updateCartItemAction(itemId, quantity);
      if (!result.ok) setError(result.error);
      await refresh();
    } catch {
      setError("Impossible de mettre à jour le panier. Réessayez.");
    } finally {
      setPending(null);
    }
  }

  async function remove(itemId: string) {
    setPending(itemId);
    setError(null);
    try {
      const result = await removeCartItemAction(itemId);
      if (!result.ok) setError(result.error);
      await refresh();
      router.refresh();
    } catch {
      setError("Impossible de retirer cet article. Réessayez.");
    } finally {
      setPending(null);
    }
  }

  async function clear() {
    setPending("clear");
    setError(null);
    try {
      const result = await clearCartAction();
      if (!result.ok) setError(result.error);
      await refresh();
      router.refresh();
    } catch {
      setError("Impossible de vider le panier. Réessayez.");
    } finally {
      setPending(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Votre panier est vide"
        message="De belles pièces vous attendent."
        action={
          <Link href="/shop" className="btn btn-primary">
            Découvrir la boutique
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      {error && (
        <p className="border border-[#9e342e]/30 bg-[#fff8f7] p-4 text-sm text-[#9e342e] lg:col-span-2" role="alert">
          {error}
        </p>
      )}
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
                  <p className="mt-1 text-sm text-ink-soft">{formatDA(item.unitPrice)} / pièce</p>
                </div>
                <button
                  type="button"
                  aria-label={`Retirer ${item.productName}`}
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
          <h2 className="text-xs font-medium uppercase tracking-[0.2em]">Résumé de commande</h2>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-ink-soft">Sous-total</span>
            <span className="font-medium">{formatDA(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {floor ? `Livraison dès ${formatDA(floor.minHome)} · ` : ""}
            Frais exacts calculés à la commande. Paiement à la livraison.
          </p>
          <Link href="/checkout" className="btn btn-primary mt-5 w-full">
            Commander
          </Link>
          <div className="mt-2 flex justify-between">
            <Link href="/shop" className="btn btn-ghost flex-1">
              Continuer mes achats
            </Link>
            <button
              type="button"
              onClick={() => void clear()}
              disabled={pending === "clear"}
              className="ml-2 px-2 text-xs uppercase tracking-[0.14em] text-ink-muted underline underline-offset-2 disabled:opacity-40"
            >
              Vider
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
