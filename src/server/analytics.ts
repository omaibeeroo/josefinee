import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Server-side analytics events. Never blocks a user flow — failures are logged.
 * Client-side pixels (GA / Meta / TikTok) are configured separately through
 * public IDs in settings and loaded only with consent.
 */
export async function trackEvent(input: {
  name: string;
  props?: Prisma.InputJsonValue;
  customerId?: string | null;
  sessionId?: string | null;
  url?: string | null;
  referrer?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        props: input.props,
        customerId: input.customerId ?? null,
        sessionId: input.sessionId ?? null,
        url: input.url ?? null,
        referrer: input.referrer ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[analytics] failed to track", input.name, error);
  }
}

export const ANALYTICS_EVENTS = {
  PAGE_VIEW: "page_view",
  PRODUCT_VIEW: "product_view",
  SEARCH: "search",
  ADD_TO_CART: "add_to_cart",
  REMOVE_FROM_CART: "remove_from_cart",
  BEGIN_CHECKOUT: "begin_checkout",
  CHECKOUT_STARTED: "checkout_started",
  ORDER_CREATED: "order_created",
  PURCHASE: "purchase",
  WISHLIST_ADD: "wishlist_add",
  COUPON_USED: "coupon_used",
} as const;
