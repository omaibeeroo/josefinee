import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/config/brand";
import { storefrontProductWhere } from "@/server/catalog";
import {
  parseSitemapId,
  sitemapPartitionIds,
  SITEMAP_URLS_PER_PARTITION,
  type SitemapId,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

const fixedSitemap = [{ id: "fixed" as SitemapId }];

export class SitemapDiscoveryError extends Error {
  constructor() {
    super("Sitemap partition discovery failed");
    this.name = "SitemapDiscoveryError";
  }
}

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
      ...sitemapPartitionIds("products", products).map((id) => ({ id })),
      ...sitemapPartitionIds("collections", collections).map((id) => ({ id })),
      ...sitemapPartitionIds("categories", categories).map((id) => ({ id })),
      ...sitemapPartitionIds("pages", pages).map((id) => ({ id })),
    ];
  } catch (error) {
    console.warn(
      "[sitemap] dynamic partition discovery unavailable; serving fixed sitemap only",
      error instanceof Error ? error.name : "unknown",
    );
    throw new SitemapDiscoveryError();
  }
}

export default async function sitemap({
  id,
}: {
  id: string | Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
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

  const parsed = parseSitemapId(sitemapId);
  if (!parsed) return [];
  const { resource, page } = parsed;
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
  if (page >= Math.ceil(count / SITEMAP_URLS_PER_PARTITION)) return [];
  const skip = page * SITEMAP_URLS_PER_PARTITION;
  const take = SITEMAP_URLS_PER_PARTITION;

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
