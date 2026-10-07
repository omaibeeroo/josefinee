import type { Metadata } from "next";
import { cache } from "react";
import { after } from "next/server";
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
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const getCollection = cache((slug: string) =>
  prisma.collection.findFirst({
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
    }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();
  const title = collection.seoTitle || collection.name;
  const description = collection.seoDescription || collection.description || undefined;
  return {
    title,
    description,
    // Filter/sort query strings never canonicalize — one URL per collection.
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: collection.image ? [{ url: collection.image }] : undefined,
    },
    twitter: {
      card: collection.image ? "summary_large_image" : "summary",
      title,
      description,
      images: collection.image ? [collection.image] : undefined,
    },
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
  after(() => trackEvent({ name: ANALYTICS_EVENTS.VIEW_COLLECTION, props: { slug: collection.slug } }));
  const [result, facets, t] = await Promise.all([
    getStorefrontProducts({
      ...query,
      collectionSlug: collection.slug,
      ...(collection.type === "MANUAL" ? {} : { type: collection.type }),
    }),
    getFilterFacets(),
    getDictionary(),
  ]);

  return (
    <div className="py-10 md:py-14">
      <div className="container-luxe mb-8 text-center">
        <p className="eyebrow mb-2">{t.collections.collection}</p>
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
                  href={(page) => `/collections/${slug}${withPage(queryParams, page)}`}
                  prevLabel={t.pagination.previous}
                  nextLabel={t.pagination.next}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
