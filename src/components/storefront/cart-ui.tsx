"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import {
  addToCartAction,
  fetchCart,
  getDeliveryFloorAction,
  removeCartItemAction,
  updateCartItemAction,
} from "@/server/actions/cart";
import type { CartSummary } from "@/server/cart";
import { Drawer, QuantitySelector, Button } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";
import { formatDA } from "@/lib/money";

type CartContextValue = CartSummary & {
  open: boolean;
  setOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  add: (variantId: string, quantity?: number) => Promise<{ ok: boolean; error?: string }>;
  error: string | null;
  floor: { minHome: number } | null;
};

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY: CartSummary = { cartId: null, items: [], subtotal: 0, count: 0 };

export function CartProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [summary, setSummary] = useState<CartSummary>(EMPTY);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [floor, setFloor] = useState<{ minHome: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await fetchCart());
      setError(null);
    } catch {
      setError(t.cart.loadFailed);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
    void getDeliveryFloorAction()
      .then(setFloor)
      .catch(() => undefined);
  }, [refresh]);

  const add = useCallback(
    async (variantId: string, quantity = 1) => {
      const result = await addToCartAction(variantId, quantity);
      if (!result.ok) return { ok: false as const, error: result.error };
      setError(null);
      await refresh();
      setOpen(true);
      return { ok: true as const };
    },
    [refresh],
  );

  const value = useMemo<CartContextValue>(
    () => ({ ...summary, open, setOpen, refresh, add, error, floor }),
    [summary, open, refresh, add, error, floor],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}

function CartDrawer() {
  const { locale, t } = useLocale();
  const { open, setOpen, items, subtotal, count, floor, error: loadError } = useCart();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useCart();

  async function changeQuantity(itemId: string, quantity: number) {
    setPending(itemId);
    setError(null);
    const result = await updateCartItemAction(itemId, quantity);
    if (!result.ok) setError(result.error);
    await refresh();
    setPending(null);
  }

  async function removeItem(itemId: string) {
    setPending(itemId);
    setError(null);
    try {
      const result = await removeCartItemAction(itemId);
      if (!result.ok) setError(result.error ?? t.cart.removeFailed);
      await refresh();
    } catch {
      setError(t.cart.removeFailed);
    } finally {
      setPending(null);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      title={`${t.cart.drawerTitle} (${count})`}
      className="cart-drawer"
    >
      <div className="flex h-full flex-col">
        {(error || loadError) && (
          <p className="border-b hairline px-5 py-3 text-sm text-[#9e342e]" role="alert">
            {error ?? loadError}
          </p>
        )}
        {loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="font-display text-2xl">{t.cart.cartUnavailable}</p>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                {t.common.retry}
              </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="font-display text-2xl">{t.cart.empty}</p>
            <p className="text-sm text-ink-soft">{t.cart.emptyHint}</p>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t.cart.continueShopping}
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line px-5">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  <Link
                    href={`/products/${item.productSlug}`}
                    onClick={() => setOpen(false)}
                    className="relative h-24 w-20 shrink-0 overflow-hidden bg-cream"
                    aria-label={item.productName}
                  >
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.productName}
                        fill
                        sizes="80px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-xl text-ink-muted">
                        {item.productName.charAt(0)}
                      </span>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/products/${item.productSlug}`}
                          onClick={() => setOpen(false)}
                          className="text-sm font-medium"
                        >
                          {item.productName}
                        </Link>
                        {item.variantLabel && (
                          <p className="mt-0.5 text-xs text-ink-muted">{item.variantLabel}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`${t.cart.removeItem} ${item.productName}`}
                        disabled={pending === item.id}
                        onClick={() => void removeItem(item.id)}
                        className="p-1 text-ink-muted hover:text-ink disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QuantitySelector
                        small
                        value={item.quantity}
                        max={Math.min(20, Math.max(item.available, item.quantity))}
                        onChange={(quantity) => void changeQuantity(item.id, quantity)}
                      />
                      <p className="text-sm font-medium">{formatDA(item.lineTotal, locale)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t hairline bg-white px-5 py-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm text-ink-soft">{t.cart.subtotal}</span>
                <span className="text-base font-medium">{formatDA(subtotal, locale)}</span>
              </div>
              <p className="mb-4 text-xs text-ink-muted">
                {floor ? `${t.cart.deliveryFrom} ${formatDA(floor.minHome, locale)} · ` : ""}
                {t.cart.deliveryNote}
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/checkout"
                  onClick={() => setOpen(false)}
                  className="btn btn-primary w-full"
                >
                  {t.cart.checkout}
                </Link>
                <Link href="/cart" onClick={() => setOpen(false)} className="btn btn-ghost w-full">
                  {t.cart.viewBag}
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
