import type { Metadata } from "next";
import { cache } from "react";
import { after } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStorefrontProducts } from "@/server/catalog";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";
import { CatalogToolbar, ProductGrid } from "@/components/storefront/catalog-ui";
import { EmptyState } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { parseCatalogParams, withPage } from "../../catalog-helpers";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const getCategory = cache((slug: string) =>
  prisma.category.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { name: true, slug: true },
        },
      },
    }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const title = category.seoTitle || category.name;
  const description = category.seoDescription || category.description || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const queryParams = await searchParams;
  const category = await getCategory(slug);
  if (!category) notFound();

  const query = parseCatalogParams(queryParams);
  after(() => trackEvent({ name: ANALYTICS_EVENTS.VIEW_COLLECTION, props: { slug: `category:${category.slug}` } }));
  const [result, t] = await Promise.all([
    getStorefrontProducts({
      ...query,
      categorySlugs: [category.slug, ...category.children.map((child) => child.slug)],
    }),
    getDictionary(),
  ]);

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="mb-6 text-center">
        <p className="eyebrow mb-2">{t.category.eyebrow}</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">{category.name}</h1>
        {category.description && (
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">{category.description}</p>
        )}
      </div>

      {category.children.length > 0 && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {category.children.map((child) => (
            <Link
              key={child.slug}
              href={`/categories/${child.slug}`}
              className="border hairline bg-white px-4 py-2 text-sm hover:border-ink"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <CatalogToolbar total={result.total} />

      <div className="flex gap-8">
        <div className="min-w-0 flex-1">
          {result.items.length === 0 ? (
            <EmptyState
              title={t.collections.emptyCollection}
              message={t.collections.emptyCollectionHint}
              action={
                <Link href="/shop" className="btn btn-outline">
                  {t.collections.viewShop}
                </Link>
              }
            />
          ) : (
            <>
              <ProductGrid products={result.items} />
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                href={(page) => `/categories/${slug}${withPage(queryParams, page)}`}
                prevLabel={t.pagination.previous}
                nextLabel={t.pagination.next}
                navLabel={t.pagination.navLabel}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
