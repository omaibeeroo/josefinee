"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toUserMessage } from "@/lib/errors";
import { zId } from "@/lib/validation/common";
import { getActionT } from "@/lib/i18n/server";
import {
  addToCart,
  clearCart,
  getCartSummary,
  removeCartItem,
  setCartItemQuantity,
} from "@/server/cart";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";
import { getCustomerSession } from "@/lib/auth/session";
import { clientIp, enforceRateLimit, LIMITS } from "@/lib/rate-limit";

async function enforceCartMutationLimit(operation: string): Promise<void> {
  const ip = await clientIp();
  await enforceRateLimit({ ...LIMITS.cartMutation, key: `cart:${operation}:${ip}` });
}

export async function fetchCart() {
  return getCartSummary();
}

export async function getQuickAddAction(productId: string) {
  const parsedId = zId.safeParse(productId);
  if (!parsedId.success) return null;
  const { getQuickAddData } = await import("@/server/catalog");
  return getQuickAddData(parsedId.data);
}

export async function getDeliveryFloorAction() {
  const { getDeliveryFloor } = await import("@/server/delivery");
  return getDeliveryFloor();
}

export async function addToCartAction(variantId: string, quantity = 1) {
  const tErr = await getActionT();
  const parsed = z.object({ variantId: zId, quantity: z.number().int().min(1).max(20) })
    .safeParse({ variantId, quantity });
  if (!parsed.success) return { ok: false as const, error: tErr.validItem };
  try {
    await enforceCartMutationLimit("add");
    const { added, count } = await addToCart(parsed.data.variantId, parsed.data.quantity);
    const customer = await getCustomerSession().catch(() => null);
    after(async () => {
      await trackEvent({
        name: ANALYTICS_EVENTS.ADD_TO_CART,
        props: { variantId: parsed.data.variantId, quantity: added },
        customerId: customer?.customer.id ?? null,
      });
    });
    revalidatePath("/cart");
    return { ok: true as const, added, count };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function updateCartItemAction(itemId: string, quantity: number) {
  const tErr = await getActionT();
  const parsed = z.object({ itemId: zId, quantity: z.number().int().min(0).max(20) })
    .safeParse({ itemId, quantity });
  if (!parsed.success) return { ok: false as const, error: tErr.validQuantity };
  try {
    await enforceCartMutationLimit("update");
    await setCartItemQuantity(parsed.data.itemId, parsed.data.quantity);
    revalidatePath("/cart");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function removeCartItemAction(itemId: string) {
  const tErr = await getActionT();
  const parsedId = zId.safeParse(itemId);
  if (!parsedId.success) return { ok: false as const, error: tErr.itemUnavailable };
  try {
    await enforceCartMutationLimit("remove");
    await removeCartItem(parsedId.data);
    revalidatePath("/cart");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function clearCartAction() {
  try {
    await enforceCartMutationLimit("clear");
    await clearCart();
    revalidatePath("/cart");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function previewCouponAction(code: string) {
  const tErr = await getActionT();
  const parsedCode = z.string().trim().min(1).max(40).safeParse(code);
  if (!parsedCode.success) return { ok: false as const, error: tErr.validPromo };
  const normalized = parsedCode.data.toUpperCase();
  try {
    const ip = await clientIp();
    await enforceRateLimit({ ...LIMITS.coupon, key: `coupon:${ip}` });
    const { validateCoupon, isFirstOrder } = await import("@/server/coupons");
    const { resolveBestPromotion } = await import("@/server/promotions");
    const cart = await getCartSummary();
    if (cart.items.length === 0) {
      return { ok: false as const, error: tErr.bagEmpty };
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