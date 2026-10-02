import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("Luna Pearl Necklace")).toBe("luna-pearl-necklace");
    expect(slugify("Caftan Élégant — Édition Limitée")).toBe("caftan-elegant-edition-limitee");
    expect(slugify("  Bags & Wallets!! ")).toBe("bags-wallets");
  });
});

describe("uniqueSlug", () => {
  it("appends a suffix on collision", () => {
    const slug = uniqueSlug("Luna", ["luna"]);
    expect(slug).not.toBe("luna");
    expect(slug.startsWith("luna-")).toBe(true);
  });

  it("keeps the base when free", () => {
    expect(uniqueSlug("Luna", ["nova"])).toBe("luna");
  });
});
