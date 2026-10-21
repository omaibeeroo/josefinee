import { describe, expect, it } from "vitest";
import { parseSitemapId, sitemapPartitionIds, SITEMAP_URLS_PER_PARTITION } from "@/lib/seo";

describe("sitemap helpers", () => {
  it("creates no empty partitions and splits public resources at the documented limit", () => {
    expect(sitemapPartitionIds("products", 0)).toEqual([]);
    expect(sitemapPartitionIds("products", SITEMAP_URLS_PER_PARTITION)).toEqual(["products-0"]);
    expect(sitemapPartitionIds("products", SITEMAP_URLS_PER_PARTITION + 1)).toEqual([
      "products-0",
      "products-1",
    ]);
  });

  it("only accepts known, non-negative, safe partition IDs", () => {
    expect(parseSitemapId("products-0")).toEqual({ resource: "products", page: 0 });
    expect(parseSitemapId("pages-12")).toEqual({ resource: "pages", page: 12 });
    expect(parseSitemapId("fixed")).toBeNull();
    expect(parseSitemapId("products--1")).toBeNull();
    expect(parseSitemapId("private-0")).toBeNull();
    expect(parseSitemapId(`products-${Number.MAX_SAFE_INTEGER + 1}`)).toBeNull();
  });
});
