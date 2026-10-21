import { afterEach, describe, expect, it } from "vitest";
import { canOptimizeImageUrl } from "@/lib/image-url";

afterEach(() => {
  delete process.env.STORAGE_PUBLIC_HOST;
});

describe("image optimization boundaries", () => {
  it("optimizes local uploads and configured unsigned storage URLs", () => {
    process.env.STORAGE_PUBLIC_HOST = "https://cdn.example.test";
    expect(canOptimizeImageUrl("/uploads/catalog.webp")).toBe(true);
    expect(canOptimizeImageUrl("https://cdn.example.test/2026/item.webp")).toBe(true);
  });

  it("leaves signed and unrelated external URLs byte-compatible", () => {
    process.env.STORAGE_PUBLIC_HOST = "https://cdn.example.test";
    expect(canOptimizeImageUrl("https://cdn.example.test/item.webp?signature=expires")).toBe(false);
    expect(canOptimizeImageUrl("https://images.example.test/item.webp")).toBe(false);
    expect(canOptimizeImageUrl("data:image/png;base64,abc")).toBe(false);
  });
});
