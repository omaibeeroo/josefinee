import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signOrderToken, verifyOrderToken } from "@/lib/order-token";

describe("signed order-tracking tokens", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-only-auth-secret-for-order-token-tests-32chars");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("binds a valid token to its order number", () => {
    const token = signOrderToken("HS-2026-000001");

    expect(verifyOrderToken("HS-2026-000001", token)).toBe(true);
    expect(verifyOrderToken("HS-2026-000002", token)).toBe(false);
  });

  it("rejects tampered and expired tokens", () => {
    const valid = signOrderToken("HS-2026-000001");
    const [expiry, signature] = valid.split(".");
    const firstCharacter = signature?.[0] === "A" ? "B" : "A";
    const tampered = `${expiry}.${firstCharacter}${signature?.slice(1)}`;

    expect(verifyOrderToken("HS-2026-000001", tampered)).toBe(false);
    expect(verifyOrderToken("HS-2026-000001", signOrderToken("HS-2026-000001", -1))).toBe(false);
    expect(verifyOrderToken("HS-2026-000001", undefined)).toBe(false);
  });
});
