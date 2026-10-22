import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  clientIp: vi.fn(),
  enforceRateLimit: vi.fn(),
  getActionT: vi.fn(),
  signOrderToken: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findFirst: mocks.findFirst } } }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: mocks.clientIp,
  enforceRateLimit: mocks.enforceRateLimit,
  LIMITS: { lookup: { limit: 10, windowMs: 900_000 } },
}));
vi.mock("@/lib/i18n/server", () => ({ getActionT: mocks.getActionT }));
vi.mock("@/lib/order-token", () => ({ signOrderToken: mocks.signOrderToken }));
vi.mock("@/server/orders", () => ({ createOrder: vi.fn() }));
vi.mock("@/server/cart", () => ({ getCartForCheckout: vi.fn() }));
vi.mock("@/server/delivery", () => ({
  getActiveWilayas: vi.fn(),
  getCommunes: vi.fn(),
  getDeliveryOptions: vi.fn(),
}));
vi.mock("@/server/analytics", () => ({
  trackEvent: vi.fn(),
  ANALYTICS_EVENTS: { ORDER_CREATED: "ORDER_CREATED" },
}));

import { lookupOrderAction } from "./checkout";

const orderNumber = "HS-2026-000001";
const phone = "0550123456";

describe("public order tracking privacy boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getActionT.mockResolvedValue({
      lookupHint: "Enter the order number and phone used at checkout.",
      orderNotFound: "Order not found.",
      wentWrong: "Something went wrong.",
    });
    mocks.clientIp.mockResolvedValue("203.0.113.8");
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.findFirst.mockResolvedValue(null);
    mocks.signOrderToken.mockReturnValue("signed-order-token");
  });

  it("requires both the order number and phone in the lookup and gives a generic miss", async () => {
    const result = await lookupOrderAction(orderNumber, phone);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ orderNumber, phone: expect.any(String) }),
      select: { orderNumber: true },
    });
    expect(result).toEqual({ ok: false, error: "Order not found." });
  });

  it("issues a short-lived signed token only after a matching phone/order lookup", async () => {
    mocks.findFirst.mockResolvedValueOnce({ orderNumber });

    const result = await lookupOrderAction(orderNumber, phone);

    expect(result).toEqual({ ok: true, orderNumber, trackingToken: "signed-order-token" });
    expect(mocks.signOrderToken).toHaveBeenCalledWith(orderNumber, 24 * 60 * 60_000);
  });

  it("rejects malformed input before rate-limit or database access", async () => {
    const result = await lookupOrderAction("", "");

    expect(result).toEqual({ ok: false, error: "Enter the order number and phone used at checkout." });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
