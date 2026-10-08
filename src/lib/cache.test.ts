import { describe, expect, it } from "vitest";
import {
  CACHE_TAG_CATALOG,
  CACHE_TAG_NAVIGATION,
  CATALOG_REVALIDATE_SECONDS,
  stableCatalogQueryKey,
} from "@/lib/cache";

describe("catalog cache keys", () => {
  it("is stable regardless of object key order", () => {
    const a = stableCatalogQueryKey({ search: "bague", page: 2, sort: "price-asc" });
    const b = stableCatalogQueryKey({ sort: "price-asc", page: 2, search: "bague" });
    expect(a).toBe(b);
  });

  it("sorts array fields so equivalent filters share an entry", () => {
    const a = stableCatalogQueryKey({ colors: ["rouge", "noir"] });
    const b = stableCatalogQueryKey({ colors: ["noir", "rouge"] });
    expect(a).toBe(b);
  });

  it("distinguishes different sorts, pages, and scopes", () => {
    const base = stableCatalogQueryKey({ collectionSlug: "bijoux" });
    expect(stableCatalogQueryKey({ collectionSlug: "bijoux", sort: "price-asc" })).not.toBe(base);
    expect(stableCatalogQueryKey({ collectionSlug: "bijoux", page: 2 })).not.toBe(base);
    expect(stableCatalogQueryKey({ collectionSlug: "sacs" })).not.toBe(base);
  });

  it("exposes sane tags and window", () => {
    expect(CACHE_TAG_CATALOG).toBe("catalog");
    expect(CACHE_TAG_NAVIGATION).toBe("navigation");
    expect(CATALOG_REVALIDATE_SECONDS).toBe(300);
  });
});
