import { describe, expect, it } from "vitest";
import { AppError, localizeAppError, toUserMessage } from "@/lib/errors";

const t = {
  bagEmpty: "BAG_EMPTY_T",
  couponInvalid: "COUPON_INVALID_T",
  validQuantity: "VALID_QTY_T",
};

describe("toUserMessage", () => {
  it("returns the app error message and hides internals", () => {
    expect(toUserMessage(new AppError("X", "visible"))).toBe("visible");
    expect(toUserMessage(new Error("secret stack"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("localizeAppError", () => {
  it("maps stable codes to dictionary strings", () => {
    expect(localizeAppError(new AppError("CART_EMPTY", "Your bag is empty.", 400), t)).toBe(
      "BAG_EMPTY_T",
    );
    expect(localizeAppError(new AppError("COUPON_INVALID", "x"), t)).toBe("COUPON_INVALID_T");
    expect(localizeAppError(new AppError("INVALID_QUANTITY", "x"), t)).toBe("VALID_QTY_T");
  });

  it("falls back to the embedded message for unmapped codes", () => {
    expect(localizeAppError(new AppError("RATE_LIMITED", "Slow down.", 429), t)).toBe(
      "Slow down.",
    );
    expect(localizeAppError(new Error("boom"), t)).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("falls back when the dictionary lacks the key", () => {
    expect(localizeAppError(new AppError("CART_EMPTY", "Your bag is empty.", 400), {})).toBe(
      "Your bag is empty.",
    );
  });
});
