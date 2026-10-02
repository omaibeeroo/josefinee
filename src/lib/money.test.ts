import { describe, expect, it } from "vitest";
import { discountPercent, formatDA, formatNumber } from "@/lib/money";

// fr-FR groups thousands with U+202F (narrow no-break space); \s matches it.
describe("formatDA", () => {
  it("formats whole dinars with the DA suffix", () => {
    expect(formatDA(2300)).toMatch(/^2\s300 DA$/u);
    expect(formatDA(0)).toBe("0 DA");
    expect(formatDA(1000000)).toMatch(/^1\s000\s000 DA$/u);
  });
});

describe("formatNumber", () => {
  it("groups thousands with a space", () => {
    expect(formatNumber(1234567)).toMatch(/^1\s234\s567$/u);
  });
});

describe("discountPercent", () => {
  it("computes the sale percentage", () => {
    expect(discountPercent(1900, 2300)).toBe(17);
  });

  it("returns null when there is no real discount", () => {
    expect(discountPercent(2300, 2300)).toBeNull();
    expect(discountPercent(2400, 2300)).toBeNull();
    expect(discountPercent(2300, null)).toBeNull();
    expect(discountPercent(2300, undefined)).toBeNull();
  });
});
