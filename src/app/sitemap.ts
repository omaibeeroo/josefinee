import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/config/brand";
import { storefrontProductWhere } from "@/server/catalog";

export const dynamic = "force-dynamic";

const URLS_PER_SITEMAP = 45_000;
type SitemapId = "fixed" | `products-${number}` | `collections-${number}` | `categories-${number}` | `pages-${number}`;

function pageIds(prefix: Exclude<SitemapId, "fixed"> extends `${infer P}-${number}` ? P : never, count: number): { id: SitemapId }[] {
  return Array.from({ length: Math.ceil(count / URLS_PER_SITEMAP) }, (_, index) => ({
    id: `${prefix}-${index}` as SitemapId,
  }));
}

const fixedSitemap = [{ id: "fixed" as SitemapId }];

export async function generateSitemaps(): Promise<Array<{ id: SitemapId }>> {
  try {
    const [products, collections, categories, pages] = await Promise.all([
      prisma.product.count({ where: storefrontProductWhere() }),
      prisma.collection.count({ where: { isActive: true } }),
      prisma.category.count({ where: { isActive: true } }),
      prisma.page.count({ where: { isPublished: true } }),
    ]);
    return [
      ...fixedSitemap,
      ...pageIds("products", products),
      ...pageIds("collections", collections),
      ...pageIds("categories", categories),
      ...pageIds("pages", pages),
    ];
  } catch (error) {
    console.warn("[sitemap] dynamic partition discovery unavailable; serving fixed sitemap only", error instanceof Error ? error.name : "unknown");
    return fixedSitemap;
  }
}

export default async function sitemap({ id }: { id: string | Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const sitemapId = await id;
  const base = appUrl();
  const now = new Date();

  if (sitemapId === "fixed") {
    return [
      { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
      { url: `${base}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
      { url: `${base}/collections`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
      { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
      { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ];
  }

  const match = /^(products|collections|categories|pages)-(\d+)$/.exec(sitemapId);
  if (!match) return [];
  const [, resource, pageString] = match;
  const page = Number(pageString);
  if (!Number.isSafeInteger(page) || page < 0) return [];
  let count: number;
  if (resource === "products") {
    count = await prisma.product.count({ where: storefrontProductWhere() });
  } else if (resource === "collections") {
    count = await prisma.collection.count({ where: { isActive: true } });
  } else if (resource === "categories") {
    count = await prisma.category.count({ where: { isActive: true } });
  } else {
    count = await prisma.page.count({ where: { isPublished: true } });
  }
  if (page >= Math.ceil(count / URLS_PER_SITEMAP)) return [];
  const skip = page * URLS_PER_SITEMAP;
  const take = URLS_PER_SITEMAP;

  if (resource === "products") {
    const rows = await prisma.product.findMany({
      where: storefrontProductWhere(),
      orderBy: { id: "asc" },
      select: { slug: true, updatedAt: true },
      skip,
      take,
    });
    return rows.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    }));
  }
  if (resource === "collections") {
    const rows = await prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { slug: true, updatedAt: true },
      skip,
      take,
    });
    return rows.map((collection) => ({
      url: `${base}/collections/${collection.slug}`,
      lastModified: collection.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  }
  if (resource === "categories") {
    const rows = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { slug: true, updatedAt: true },
      skip,
      take,
    });
    return rows.map((category) => ({
      url: `${base}/categories/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  }

  const rows = await prisma.page.findMany({
    where: { isPublished: true },
    orderBy: { id: "asc" },
    select: { slug: true, updatedAt: true },
    skip,
    take,
  });
  return rows.map((pageEntry) => ({
    url: `${base}/pages/${pageEntry.slug}`,
    lastModified: pageEntry.updatedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
}
