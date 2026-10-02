import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getFilterFacets, getStorefrontProducts } from "@/server/catalog";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";
import { CatalogToolbar, DesktopFilters, ProductGrid } from "@/components/storefront/catalog-ui";
import { EmptyState } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { parseCatalogParams, withPage } from "../../catalog-helpers";

export const dynamic = "force-dynamic";

async function getCollection(slug: string) {
  return prisma.collection
    .findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        type: true,
        seoTitle: true,
        seoDescription: true,
      },
    })
    .catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: "Collection" };
  return {
    title: collection.seoTitle || collection.name,
    description: collection.seoDescription || collection.description || undefined,
    // Filter/sort query strings never canonicalize — one URL per collection.
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const queryParams = await searchParams;
  const collection = await getCollection(slug);
  if (!collection) notFound();

  const query = parseCatalogParams(queryParams);
  await trackEvent({ name: ANALYTICS_EVENTS.VIEW_COLLECTION, props: { slug: collection.slug } });
  const [result, facets] = await Promise.all([
    getStorefrontProducts({
      ...query,
      collectionSlug: collection.slug,
      ...(collection.type === "MANUAL" ? {} : { type: collection.type }),
    }),
    getFilterFacets(),
  ]);

  return (
    <div className="py-10 md:py-14">
      <div className="container-luxe mb-8 text-center">
        <p className="eyebrow mb-2">Collection</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">{collection.name}</h1>
        {collection.description && (
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">{collection.description}</p>
        )}
      </div>

      {collection.image && (
        <div className="container-luxe mb-10">
          <div className="relative aspect-[21/8] overflow-hidden bg-cream">
            <Image
              src={collection.image}
              alt={collection.name}
              fill
              sizes="(max-width: 768px) 100vw, 1200px"
              className="object-cover"
            />
          </div>
        </div>
      )}

      <div className="container-luxe">
        <CatalogToolbar facets={facets} total={result.total} />
        <div className="flex gap-8">
          <DesktopFilters facets={facets} />
          <div className="min-w-0 flex-1">
            {result.items.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                message="New pieces are on their way — check back soon."
                action={
                  <Link href="/shop" className="btn btn-outline">
                    Shop all
                  </Link>
                }
              />
            ) : (
              <>
                <ProductGrid products={result.items} />
                <Pagination
                  page={result.page}
                  totalPages={result.totalPages}
                  href={(page) => `/collections/${slug}${withPage(queryParams, page)}`}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
