import type { CatalogQuery } from "@/server/catalog";

/**
 * Shared Next.js data-cache tags + windows for PUBLIC catalog reads.
 *
 * Scope rules (do not widen without review):
 * - Only merchandising display data is cached: product/category/collection
 *   listings, product detail, navigation, popular searches.
 * - NEVER cache through this layer: carts, checkout pricing, inventory
 *   mutations, coupons/promotions evaluation, orders, sessions, or any
 *   per-customer data. Those paths always read live (see AGENTS.md:
 *   the client never sets prices; inventory decrements atomically).
 * - Staleness contract: entries live at most CATALOG_REVALIDATE_SECONDS and
 *   every catalog-affecting admin mutation calls revalidateTag() next to its
 *   existing revalidatePath(). Order-driven changes (sales decrementing
 *   stock, soldCount reshuffling best-sellers) surface within the window;
 *   cart and checkout guards (availability checks, conditional stock
 *   decrement) remain the source of truth, so a stale badge can never
 *   oversell or misprice an order.
 * - Key cardinality is bounded: free-text search queries bypass the cache
 *   (one entry per unique term would grow data-cache storage without bound).
 */
export const CACHE_TAG_CATALOG = "catalog";
export const CACHE_TAG_NAVIGATION = "navigation";

/** Backstop freshness for catalog reads when no mutation revalidates first. */
export const CATALOG_REVALIDATE_SECONDS = 300;

/**
 * Stable cache key for a catalog listing query. Field order is fixed and
 * arrays are sorted so equivalent queries share one entry regardless of how
 * the caller built the object.
 */
export function stableCatalogQueryKey(query: CatalogQuery): string {
  const sorted = (values: string[] | undefined): string[] =>
    [...(values ?? [])].sort();
  return JSON.stringify({
    ids: sorted(query.ids),
    categorySlugs: sorted(query.categorySlugs ?? (query.categorySlug ? [query.categorySlug] : [])),
    collectionSlug: query.collectionSlug ?? null,
    type: query.type ?? null,
    tag: query.tag ?? null,
    search: query.search?.trim() ?? null,
    onSale: query.onSale ?? false,
    inStock: query.inStock ?? false,
    minPrice: query.minPrice ?? null,
    maxPrice: query.maxPrice ?? null,
    colors: sorted(query.colors),
    sizes: sorted(query.sizes),
    sort: query.sort ?? null,
    page: Math.max(1, query.page ?? 1),
    pageSize: query.pageSize ?? null,
  });
}
