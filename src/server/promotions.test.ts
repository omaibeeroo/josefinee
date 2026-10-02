import { describe, expect, it } from "vitest";
import { promotionDiscountFor } from "@/lib/promo-math";

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
