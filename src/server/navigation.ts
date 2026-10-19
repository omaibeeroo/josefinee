import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CACHE_TAG_NAVIGATION, CATALOG_REVALIDATE_SECONDS } from "@/lib/cache";

export type NavCategory = {
  name: string;
  slug: string;
  image: string | null;
  children: Array<{ name: string; slug: string }>;
};

async function getNavigationFresh(): Promise<{
  categories: NavCategory[];
  collections: Array<{ name: string; slug: string }>;
}> {
  try {
    const [categories, collections] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true, parentId: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          name: true,
          slug: true,
          image: true,
          children: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { name: true, slug: true },
          },
        },
      }),
      prisma.collection.findMany({
        where: { isActive: true, showInNav: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { name: true, slug: true },
        take: 12,
      }),
    ]);
    return { categories, collections };
  } catch (error) {
    console.error("[navigation] failed", error instanceof Error ? error.name : "unknown");
    return { categories: [], collections: [] };
  }
}

const getNavigationCached = unstable_cache(async () => getNavigationFresh(), ["navigation:main"], {
  revalidate: CATALOG_REVALIDATE_SECONDS,
  tags: [CACHE_TAG_NAVIGATION],
});

/** Cached header nav (see src/lib/cache.ts for scope rules). */
export async function getNavigation(): Promise<{
  categories: NavCategory[];
  collections: Array<{ name: string; slug: string }>;
}> {
  return getNavigationCached();
}

async function getPopularSearchesFresh(limit = 6): Promise<string[]> {
  try {
    // Only corroborated terms surface publicly: a single search can be spam.
    // Long strings read as noise in the search dialog, so they are filtered
    // out (bounded over-fetch — storage itself is capped by the retention
    // job, see purgeExpiredData).
    const rows = await prisma.searchQuery.findMany({
      where: { count: { gte: 2 } },
      orderBy: [{ count: "desc" }, { updatedAt: "desc" }],
      select: { term: true },
      take: limit * 8,
    });
    return rows
      .map((row) => row.term)
      .filter((term) => term.length <= 40)
      .slice(0, limit);
  } catch {
    return [];
  }
}

const getPopularSearchesCached = unstable_cache(
  async (limit: number) => getPopularSearchesFresh(limit),
  ["navigation:popular-searches"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_NAVIGATION] },
);

/** Cached popular search terms (see src/lib/cache.ts for scope rules). */
export async function getPopularSearches(limit = 6): Promise<string[]> {
  return getPopularSearchesCached(limit);
}

export async function recordSearch(term: string): Promise<void> {
  const cleaned = term.trim().slice(0, 80).toLowerCase();
  if (cleaned.length < 2) return;
  try {
    await prisma.searchQuery.upsert({
      where: { term: cleaned },
      create: { term: cleaned, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    // non-critical
  }
}
