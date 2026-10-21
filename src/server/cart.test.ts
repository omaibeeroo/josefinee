import { describe, expect, it } from "vitest";
import { isCartExpired } from "@/server/cart";

describe("cart expiry enforcement", () => {
  const now = new Date("2026-10-21T12:00:00.000Z");

  it("expires at the boundary, not only after it", () => {
    expect(isCartExpired({ expiresAt: new Date("2026-10-21T12:00:00.000Z") }, now)).toBe(true);
    expect(isCartExpired({ expiresAt: new Date("2026-10-21T11:59:59.999Z") }, now)).toBe(true);
  });

  it("keeps carts with no expiry or a future expiry usable", () => {
    expect(isCartExpired({ expiresAt: null }, now)).toBe(false);
    expect(isCartExpired({ expiresAt: new Date("2026-10-21T12:00:00.001Z") }, now)).toBe(false);
  });
});
