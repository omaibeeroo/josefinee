import { describe, expect, it } from "vitest";
import { hasAnalyticsConsent } from "./pixel-consent";

describe("marketing pixel consent", () => {
  it("is default-off until the exact accepted value is stored", () => {
    expect(hasAnalyticsConsent(null)).toBe(false);
    expect(hasAnalyticsConsent("rejected")).toBe(false);
    expect(hasAnalyticsConsent("true")).toBe(false);
    expect(hasAnalyticsConsent("accepted")).toBe(true);
  });
});
