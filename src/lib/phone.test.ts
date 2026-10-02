import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, isValidAlgerianPhone, normalizeAlgerianPhone } from "@/lib/phone";

describe("normalizeAlgerianPhone", () => {
  it.each([
    ["0550123456", "0550123456"],
    ["0550 12 34 56", "0550123456"],
    ["05-50-12-34-56", "0550123456"],
    ["+213550123456", "0550123456"],
    ["+213 550 12 34 56", "0550123456"],
    ["00213550123456", "0550123456"],
    ["213650123456", "0650123456"],
    ["0770123456", "0770123456"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeAlgerianPhone(input)).toBe(expected);
  });

  it.each([
    ["", null],
    ["055012345", null], // too short
    ["05501234567", null], // too long
    ["0212345678", null], // landline prefix
    ["0440123456", null], // landline prefix
    ["+21355012345", null], // short international
    ["not-a-number", null],
    ["055012345a", null],
  ])("rejects %s", (input) => {
    expect(normalizeAlgerianPhone(input)).toBeNull();
  });
});

describe("isValidAlgerianPhone", () => {
  it("accepts mobiles and rejects the rest", () => {
    expect(isValidAlgerianPhone("0600112233")).toBe(true);
    expect(isValidAlgerianPhone("+213701122334")).toBe(true);
    expect(isValidAlgerianPhone("12345")).toBe(false);
    expect(isValidAlgerianPhone(null)).toBe(false);
  });
});

describe("formatPhoneDisplay", () => {
  it("groups digits for display", () => {
    expect(formatPhoneDisplay("0550123456")).toBe("0550 12 34 56");
  });

  it("returns the input unchanged when invalid", () => {
    expect(formatPhoneDisplay("oops")).toBe("oops");
  });
});
