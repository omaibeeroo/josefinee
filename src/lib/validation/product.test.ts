import { describe, expect, it } from "vitest";
import { productImageUrl, productSchema } from "@/lib/validation/product";

describe("productImageUrl", () => {
  it("accepts absolute https URLs (S3/R2/CDN)", () => {
    expect(
      productImageUrl.safeParse("https://cdn.example.com/p/pendant.webp").success,
    ).toBe(true);
  });

  it("accepts app-relative upload paths from the local storage driver", () => {
    expect(productImageUrl.safeParse("/uploads/2026/10/pendant-1.webp").success).toBe(
      true,
    );
  });

  it("rejects non-URL strings and dangerous schemes", () => {
    for (const bad of ["not-a-url", "javascript:alert(1)", "data:image/png;base64,AAA", ""]) {
      expect(productImageUrl.safeParse(bad).success).toBe(false);
    }
  });
});

describe("productSchema images", () => {
  const base = {
    name: "Parure Perle Éclat",
    price: 4500,
    variants: [{ sku: "TEST-PERLE-001", stock: 20 }],
  };

  it("accepts products whose images use local /uploads paths", () => {
    const result = productSchema.safeParse({
      ...base,
      images: [{ url: "/uploads/2026/10/pendant-1.webp", sortOrder: 0, isPrimary: true }],
    });
    expect(result.success).toBe(true);
  });

  it("still rejects products with invalid image URLs", () => {
    const result = productSchema.safeParse({
      ...base,
      images: [{ url: "javascript:alert(1)", sortOrder: 0, isPrimary: true }],
    });
    expect(result.success).toBe(false);
  });
});
