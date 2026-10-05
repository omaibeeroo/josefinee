import "server-only";
import { prisma } from "@/lib/prisma";

export type NavCategory = {
  name: string;
  slug: string;
  image: string | null;
  children: Array<{ name: string; slug: string }>;
};

export async function getNavigation(): Promise<{
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

export async function getPopularSearches(limit = 6): Promise<string[]> {
  try {
    const rows = await prisma.searchQuery.findMany({
      orderBy: [{ count: "desc" }, { updatedAt: "desc" }],
      select: { term: true },
      take: limit,
    });
    return rows.map((row) => row.term);
  } catch {
    return [];
  }
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
