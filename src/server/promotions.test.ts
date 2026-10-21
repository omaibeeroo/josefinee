import { describe, expect, it } from "vitest";
import { promotionDiscountFor } from "@/lib/promo-math";
import { rankPromotionBadge, resolveBestPromotion } from "@/server/promotions";

describe("promotionDiscountFor", () => {
  it("computes percentage discounts floored to the dinar", () => {
    expect(promotionDiscountFor({ type: "PERCENTAGE", value: 10 }, 2900)).toBe(290);
    expect(promotionDiscountFor({ type: "PERCENTAGE", value: 15 }, 1999)).toBe(299);
  });

  it("caps percentages at 90 no matter the configuration", () => {
    expect(promotionDiscountFor({ type: "PERCENTAGE", value: 100 }, 1000)).toBe(900);
    expect(promotionDiscountFor({ type: "PERCENTAGE", value: 999 }, 1000)).toBe(900);
  });

  it("caps fixed discounts at the eligible subtotal", () => {
    expect(promotionDiscountFor({ type: "FIXED", value: 500 }, 1200)).toBe(500);
    expect(promotionDiscountFor({ type: "FIXED", value: 5000 }, 1200)).toBe(1200);
  });

  it("returns zero for empty subtotals", () => {
    expect(promotionDiscountFor({ type: "PERCENTAGE", value: 10 }, 0)).toBe(0);
    expect(promotionDiscountFor({ type: "FIXED", value: 100 }, 0)).toBe(0);
  });
});

describe("rankPromotionBadge", () => {
  const fixed = { name: "Fixed 500", type: "FIXED" as const, value: 500 };
  const percent = { name: "20% off", type: "PERCENTAGE" as const, value: 20 };

  it("compares percentage and fixed promotions in dinar terms, not on one scale", () => {
    // 2 000 DA item: 20% = 400 DA, so the 500 DA fixed promotion wins.
    expect(rankPromotionBadge([percent, fixed], 2000)).toBe(fixed);
    // 4 000 DA item: 20% = 800 DA, so the percentage wins.
    expect(rankPromotionBadge([percent, fixed], 4000)).toBe(percent);
  });

  it("keeps the first promotion on equal discounts", () => {
    const first = { name: "10% A", type: "PERCENTAGE" as const, value: 10 };
    const second = { name: "10% B", type: "PERCENTAGE" as const, value: 10 };
    expect(rankPromotionBadge([first, second], 1000)).toBe(first);
  });

  it("never picks a promotion that yields no discount", () => {
    expect(rankPromotionBadge([{ name: "Zero", type: "FIXED", value: 0 }], 1000)).toBeNull();
    expect(rankPromotionBadge([], 1000)).toBeNull();
  });
});

describe("resolveBestPromotion", () => {
  it("does not omit the best eligible offer after fifty active promotions", async () => {
    const now = new Date("2026-10-21T12:00:00.000Z");
    const promotions = Array.from({ length: 51 }, (_, index) => ({
      id: `promotion-${index}`,
      name: `Promotion ${index}`,
      type: "FIXED" as const,
      value: index === 50 ? 900 : 10,
      startsAt: new Date("2026-10-01T00:00:00.000Z"),
      endsAt: new Date("2026-11-01T00:00:00.000Z"),
      isActive: true,
      collectionId: null,
      createdAt: new Date(now.getTime() - index * 1_000),
      updatedAt: now,
      products: [],
      collection: null,
    }));
    const db = {
      promotion: { findMany: async () => promotions },
    } as never;

    await expect(
      resolveBestPromotion(
        [{ productId: "product-1", collectionIds: [], unitPrice: 1_000, quantity: 1 }],
        now,
        db,
      ),
    ).resolves.toMatchObject({ promotionId: "promotion-50", discount: 900 });
  });
});
