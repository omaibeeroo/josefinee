import { beforeEach, describe, expect, it, vi } from "vitest";

const { couponFindUnique, couponRedemptionCount, deliveryFindFirst, queryRaw } = vi.hoisted(() => ({
  couponFindUnique: vi.fn(),
  couponRedemptionCount: vi.fn(),
  deliveryFindFirst: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coupon: { findUnique: couponFindUnique },
    couponRedemption: { count: couponRedemptionCount },
    deliveryRate: { findFirst: deliveryFindFirst },
  },
}));

import { validateCoupon, consumeCoupon } from "@/server/coupons";
import { resolveDeliveryRate } from "@/server/delivery";

describe("server-side checkout pricing", () => {
  beforeEach(() => {
    couponFindUnique.mockReset();
    couponRedemptionCount.mockReset();
    deliveryFindFirst.mockReset();
    queryRaw.mockReset();
    couponRedemptionCount.mockResolvedValue(0);
  });

  it("calculates a percentage coupon from server-provided line values and caps it", async () => {
    couponFindUnique.mockResolvedValue({
      id: "coupon-1",
      code: "SAVE90",
      isActive: true,
      startsAt: null,
      endsAt: null,
      usageLimit: null,
      usageCount: 0,
      firstOrderOnly: false,
      perCustomerLimit: null,
      minOrder: 1000,
      maxDiscount: 2500,
      type: "PERCENTAGE",
      value: 90,
      appliesToAll: true,
      products: [],
      collections: [],
      wilayas: [],
    });

    const result = await validateCoupon({
      code: " save90 ",
      lines: [{ productId: "p1", unitPrice: 5000, quantity: 1 }],
      subtotal: 5000,
      wilayaId: "w1",
      phone: "0550123456",
      isFirstOrder: true,
    });

    expect(result.discount).toBe(2500);
    expect(result.code).toBe("SAVE90");
    expect(couponFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "SAVE90" } }),
    );
  });

  it("only discounts eligible scoped lines and never exceeds the submitted subtotal", async () => {
    couponFindUnique.mockResolvedValue({
      id: "coupon-2",
      code: "JEWELRY",
      isActive: true,
      startsAt: null,
      endsAt: null,
      usageLimit: null,
      usageCount: 0,
      firstOrderOnly: false,
      perCustomerLimit: null,
      minOrder: null,
      maxDiscount: null,
      type: "FIXED",
      value: 10000,
      appliesToAll: false,
      products: [{ productId: "eligible" }],
      collections: [],
      wilayas: [],
    });

    const result = await validateCoupon({
      code: "JEWELRY",
      lines: [
        { productId: "eligible", unitPrice: 1200, quantity: 2 },
        { productId: "other", unitPrice: 9000, quantity: 1 },
      ],
      subtotal: 11400,
      wilayaId: "w1",
      phone: "0550123456",
      isFirstOrder: false,
    });

    expect(result.discount).toBe(2400);
  });

  it("enforces date, wilaya, first-order, and usage rules from the database state", async () => {
    couponFindUnique.mockResolvedValue({
      id: "coupon-3",
      code: "LIMITED",
      isActive: true,
      startsAt: new Date(Date.now() + 60_000),
      endsAt: null,
      usageLimit: 1,
      usageCount: 0,
      firstOrderOnly: true,
      perCustomerLimit: null,
      minOrder: null,
      maxDiscount: null,
      type: "PERCENTAGE",
      value: 10,
      appliesToAll: true,
      products: [],
      collections: [],
      wilayas: [{ wilayaId: "w2" }],
    });

    await expect(
      validateCoupon({
        code: "LIMITED",
        lines: [{ productId: "p", unitPrice: 1000, quantity: 1 }],
        subtotal: 1000,
        wilayaId: "w1",
        phone: "0550123456",
        isFirstOrder: false,
      }),
    ).rejects.toMatchObject({ code: "COUPON_NOT_STARTED" });
  });

  it("falls back to active home delivery when the requested method is unavailable", async () => {
    deliveryFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ price: 700, etaMinDays: 2, etaMaxDays: 4 });

    await expect(resolveDeliveryRate("w1", "STOPDESK" as never)).resolves.toEqual({
      price: 700,
      etaMinDays: 2,
      etaMaxDays: 4,
    });
    expect(deliveryFindFirst).toHaveBeenNthCalledWith(2, {
      where: { wilayaId: "w1", method: "HOME", isActive: true },
    });
  });

  it("uses the atomic database consumption result and rejects exhausted limits", async () => {
    queryRaw.mockResolvedValueOnce([{ id: "coupon-1" }]);
    await expect(
      consumeCoupon({ $queryRaw: queryRaw } as never, {
        couponId: "coupon-1",
        phone: "0550123456",
      }),
    ).resolves.toBeUndefined();

    queryRaw.mockResolvedValueOnce([]);
    await expect(
      consumeCoupon({ $queryRaw: queryRaw } as never, {
        couponId: "coupon-1",
        phone: "0550123456",
      }),
    ).rejects.toMatchObject({ code: "COUPON_USED_UP" });
  });
});
