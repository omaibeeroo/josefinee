export const SITEMAP_URLS_PER_PARTITION = 45_000;

export const SITEMAP_RESOURCES = ["products", "collections", "categories", "pages"] as const;
export type SitemapResource = (typeof SITEMAP_RESOURCES)[number];
export type SitemapId = "fixed" | `${SitemapResource}-${number}`;

export function sitemapPartitionIds(resource: SitemapResource, count: number): SitemapId[] {
  const safeCount = Number.isSafeInteger(count) && count > 0 ? count : 0;
  return Array.from(
    { length: Math.ceil(safeCount / SITEMAP_URLS_PER_PARTITION) },
    (_, index) => `${resource}-${index}` as SitemapId,
  );
}

export function parseSitemapId(value: string): { resource: SitemapResource; page: number } | null {
  const match = /^(products|collections|categories|pages)-(\d+)$/.exec(value);
  if (!match) return null;
  const page = Number(match[2]);
  if (!Number.isSafeInteger(page) || page < 0) return null;
  return { resource: match[1] as SitemapResource, page };
}
