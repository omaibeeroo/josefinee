"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toUserMessage } from "@/lib/errors";
import {
  addToCart,
  clearCart,
  getCartSummary,
  removeCartItem,
  setCartItemQuantity,
} from "@/server/cart";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";
import { getCustomerSession } from "@/lib/auth/session";

export type ActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string; fields?: Record<string, string> };

export async function fetchCart() {
  return getCartSummary();
}

export async function addToCartAction(variantId: string, quantity = 1) {
  try {
    const { added, count } = await addToCart(variantId, quantity);
    const customer = await getCustomerSession().catch(() => null);
    await trackEvent({
      name: ANALYTICS_EVENTS.ADD_TO_CART,
      props: { variantId, quantity: added },
      customerId: customer?.customer.id ?? null,
    });
    revalidatePath("/cart");
    return { ok: true as const, added, count };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function updateCartItemAction(itemId: string, quantity: number) {
  try {
    await setCartItemQuantity(itemId, quantity);
    revalidatePath("/cart");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function removeCartItemAction(itemId: string) {
  try {
    await removeCartItem(itemId);
    revalidatePath("/cart");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function clearCartAction() {
  try {
    await clearCart();
    revalidatePath("/cart");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function previewCouponAction(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false as const, error: "Enter a promo code." };
  try {
    const { validateCoupon, isFirstOrder } = await import("@/server/coupons");
    const { resolveBestPromotion } = await import("@/server/promotions");
    const cart = await getCartSummary();
    if (cart.items.length === 0) {
      return { ok: false as const, error: "Your bag is empty." };
    }

    const products = await prisma.product.findMany({
      where: { id: { in: cart.items.map((item) => item.productId) } },
      select: { id: true, collectionLinks: { select: { collectionId: true } } },
    });
    const collectionsByProduct = new Map(
      products.map((product) => [
        product.id,
        product.collectionLinks.map((entry) => entry.collectionId),
      ]),
    );
    const lines = cart.items.map((item) => ({
      productId: item.productId,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      collectionIds: collectionsByProduct.get(item.productId) ?? [],
    }));

    // Mirror checkout precedence: automatic promotion first, coupon on the remainder.
    const promotion = await resolveBestPromotion(lines);
    const effectiveSubtotal = Math.max(0, cart.subtotal - (promotion?.discount ?? 0));

    const customer = await getCustomerSession().catch(() => null);
    const first = await isFirstOrder({ phone: "", customerId: customer?.customer.id ?? null });
    const result = await validateCoupon({
      code: normalized,
      lines,
      subtotal: effectiveSubtotal,
      wilayaId: "",
      phone: "",
      customerId: customer?.customer.id ?? null,
      isFirstOrder: first,
      skipWilayaCheck: true,
    });
    return { ok: true as const, discount: result.discount, code: result.code };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}
