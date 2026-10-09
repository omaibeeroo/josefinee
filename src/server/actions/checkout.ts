"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAppError, localizeAppError, toUserMessage } from "@/lib/errors";
import { flattenZodErrors, isBotSubmission } from "@/lib/validation/common";
import { zId } from "@/lib/validation/common";
import { getActionT } from "@/lib/i18n/server";
import { checkoutSchema, trackOrderSchema, type CheckoutInput } from "@/lib/validation/checkout";
import { createOrder } from "@/server/orders";
import { getCartForCheckout } from "@/server/cart";
import { getActiveWilayas, getCommunes, getDeliveryOptions } from "@/server/delivery";
import { signOrderToken } from "@/lib/order-token";
import { enforceRateLimit, LIMITS, clientIp } from "@/lib/rate-limit";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";

export type SubmitOrderResult =
  | { ok: true; orderNumber: string; trackingToken: string; total: number }
  | {
      ok: false;
      error: string;
      code?: string;
      fields?: Record<string, string>;
      orderNumber?: string;
    };

export async function submitOrderAction(input: CheckoutInput): Promise<SubmitOrderResult> {
  const tErr = await getActionT();
  const ip = await clientIp();
  try {
    await enforceRateLimit({ ...LIMITS.checkout, key: `checkout:${ip}` });
  } catch (error) {
    return { ok: false, error: toUserMessage(error), code: "RATE_LIMITED" };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: tErr.reviewFields,
      fields: flattenZodErrors(parsed.error),
    };
  }
  if (isBotSubmission(parsed.data.website)) {
    return { ok: false, error: tErr.wentWrong };
  }

  const headerList = await headers();
  try {
    after(() => trackEvent({ name: ANALYTICS_EVENTS.BEGIN_CHECKOUT, ip }));
    const result = await createOrder(parsed.data, {
      ip,
      userAgent: headerList.get("user-agent"),
    });
    return {
      ok: true,
      orderNumber: result.orderNumber,
      trackingToken: result.trackingToken,
      total: result.total,
    };
  } catch (error) {
    if (isAppError(error)) {
      return {
        ok: false,
        error: localizeAppError(error, tErr),
        code: error.code,
        orderNumber: (error.meta?.orderNumber as string | undefined) ?? undefined,
      };
    }
    console.error("[checkout] failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: tErr.wentWrong };
  }
}

export async function getCheckoutData() {
  const [cart, wilayas] = await Promise.all([getCartForCheckout().catch(() => null), getActiveWilayas()]);

  let promotion: { name: string; discount: number } | null = null;
  if (cart && cart.lines.length > 0) {
    const { resolveBestPromotion } = await import("@/server/promotions");
    const products = await prisma.product.findMany({
      where: { id: { in: cart.lines.map((line) => line.productId) } },
      select: { id: true, collectionLinks: { select: { collectionId: true } } },
    });
    const collectionsByProduct = new Map(
      products.map((product) => [
        product.id,
        product.collectionLinks.map((entry) => entry.collectionId),
      ]),
    );
    const resolved = await resolveBestPromotion(
      cart.lines.map((line) => ({
        productId: line.productId,
        collectionIds: collectionsByProduct.get(line.productId) ?? [],
        unitPrice: line.unitPrice,
        quantity: line.quantity,
      })),
    );
    if (resolved) promotion = { name: resolved.name, discount: resolved.discount };
  }

  return { cart, wilayas, promotion };
}

export async function getCommunesAction(wilayaId: string) {
  if (!zId.safeParse(wilayaId).success) return [];
  return getCommunes(wilayaId);
}

export async function getDeliveryOptionsAction(wilayaId: string) {
  if (!zId.safeParse(wilayaId).success) return [];
  return getDeliveryOptions(wilayaId);
}

export async function lookupOrderAction(orderNumber: string, phoneRaw: string) {
  const tErr = await getActionT();
  const parsed = trackOrderSchema.safeParse({ orderNumber, phone: phoneRaw });
  if (!parsed.success) {
    return { ok: false as const, error: tErr.lookupHint };
  }
  const ip = await clientIp();
  try {
    await Promise.all([
      enforceRateLimit({ ...LIMITS.lookup, key: `order-lookup:${ip}` }),
      enforceRateLimit({
        ...LIMITS.lookup,
        key: `order-lookup-identity:${parsed.data.orderNumber.trim().toUpperCase()}:${parsed.data.phone}`,
      }),
      enforceRateLimit({
        limit: 5,
        windowMs: 15 * 60_000,
        key: `order-lookup-phone:${parsed.data.phone}`,
      }),
    ]);
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
  try {
    const order = await prisma.order.findFirst({
      where: { orderNumber: parsed.data.orderNumber.trim().toUpperCase(), phone: parsed.data.phone },
      select: { orderNumber: true },
    });
    if (!order) {
      return { ok: false as const, error: tErr.orderNotFound };
    }
    const trackingToken = signOrderToken(order.orderNumber, 24 * 60 * 60_000);
    return { ok: true as const, orderNumber: order.orderNumber, trackingToken };
  } catch (error) {
    console.error("[track] lookup failed", error instanceof Error ? error.name : "unknown");
    return { ok: false as const, error: tErr.wentWrong };
  }
}