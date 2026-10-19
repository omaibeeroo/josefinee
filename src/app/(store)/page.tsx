import Link from "next/link";
import type { Metadata } from "next";
import { Fragment } from "react";
import { unstable_cache } from "next/cache";
import { getSettings } from "@/lib/settings";
import { resolveSiteMetadata } from "@/lib/i18n/metadata";
import {
  getBestSellers,
  getFeaturedProducts,
  getNewInProducts,
  getStorefrontProducts,
} from "@/server/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { CACHE_TAG_CATALOG, CATALOG_REVALIDATE_SECONDS } from "@/lib/cache";
import {
  CategoryGrid,
  FeaturedCollection,
  Hero,
  ProductSpotlight,
  SocialProof,
  TrustBar,
} from "@/components/storefront/home";
import { ProductCarousel } from "@/components/storefront/product";

// Route ISR is intentionally absent: the cookie locale toggle (FR/EN/AR)
// cannot vary a shared cached page, so the homepage always renders live.
// Display data underneath still uses short-lived unstable_cache entries.

export async function generateMetadata(): Promise<Metadata> {
  const [settings, dictionary] = await Promise.all([getSettings(), getDictionary()]);
  const siteMetadata = resolveSiteMetadata(settings.seo, dictionary.siteMetadata);
  return {
    description: siteMetadata.description,
  };
}

// Homepage display reads that do not belong to the catalog module but share
// the catalog staleness contract (see src/lib/cache.ts). Order status changes
// have no catalog tag to revalidate, so the delivered count rides the 300s
// backstop — it is social proof, never money or stock truth.
const getHomeCategoryTiles = unstable_cache(
  async (take: number) =>
    (
      await prisma.category.findMany({
        where: { isActive: true, parentId: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          name: true,
          slug: true,
          image: true,
          _count: { select: { products: { where: { status: "ACTIVE" } } } },
        },
        take,
      })
    ).map((category) => ({
      name: category.name,
      slug: category.slug,
      image: category.image,
      count: category._count.products,
    })),
  ["home:category-tiles"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_CATALOG] },
);

const getHomeDeliveredCount = unstable_cache(
  async () => prisma.order.count({ where: { status: "DELIVERED" } }),
  ["home:delivered-count"],
  { revalidate: CATALOG_REVALIDATE_SECONDS },
);

const getHomeFeaturedCollection = unstable_cache(
  async (slug: string) =>
    prisma.collection.findFirst({
      where: { slug, isActive: true },
      select: { name: true, slug: true, description: true, image: true },
    }),
  ["home:featured-collection"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_CATALOG] },
);

async function getHomeData() {
  // Settings first (React-cached single-row reads), then one catalog wave
  // sized by the Admin → Vitrine display density knobs. Every independent
  // read — including the featured collection, delivered count and the
  // hand-picked spotlight — joins the same wave.
  const settings = await getSettings();
  const display = settings.homepage.display;
  const spotlightId = settings.homepage.spotlightProductId;
  const fulfilled = <T,>(value: T) => ({ status: "fulfilled" as const, value });
  const failed = <T,>(value: T) => ({ status: "rejected" as const, value });
  const [
    featuredResult,
    newInResult,
    bestSellersResult,
    categoriesResult,
    deliveredResult,
    featuredCollectionResult,
    spotlightResult,
    dictionaryResult,
  ] = await Promise.all([
    getFeaturedProducts(display.featuredCount).then(fulfilled, () => failed([])),
    getNewInProducts(display.newInCount).then(fulfilled, () => failed([])),
    getBestSellers(display.bestSellersCount).then(fulfilled, () => failed([])),
    getHomeCategoryTiles(display.categoryCount).then(fulfilled, () => failed([])),
    getHomeDeliveredCount().then(fulfilled, (error: unknown) => {
      console.error("[home] data failed", error instanceof Error ? error.name : "unknown");
      return failed(0);
    }),
    getHomeFeaturedCollection(settings.homepage.featuredCollectionSlug).then(fulfilled, () => {
      return failed(null);
    }),
    spotlightId
      ? getStorefrontProducts({ ids: [spotlightId], pageSize: 1 }).then(fulfilled, () =>
          failed(null),
        )
      : Promise.resolve(fulfilled(null)),
    getDictionary().then(fulfilled),
  ]);
  const featured = featuredResult.value;
  const newIn = newInResult.value;
  const bestSellers = bestSellersResult.value;
  const catalogError =
    featuredResult.status === "rejected" ||
    newInResult.status === "rejected" ||
    bestSellersResult.status === "rejected";

  if (catalogError) {
    console.error("[home] product data failed");
  }

  const categoryTiles = categoriesResult.value ?? [];
  const featuredCollection = featuredCollectionResult.value;
  const deliveredCount =
    settings.homepage.socialProofOverride > 0
      ? settings.homepage.socialProofOverride
      : deliveredResult.value;
  const t = dictionaryResult.value;

  // Hand-picked spotlight product from Admin → Vitrine, else first featured.
  let spotlight = featured[0] ?? null;
  const picked = spotlightResult.value;
  if (picked?.items[0]) spotlight = picked.items[0];

  return {
    settings,
    featured,
    newIn,
    bestSellers,
    catalogError,
    categoryTiles,
    featuredCollection,
    deliveredCount,
    spotlight,
    t,
  };
}

export default async function HomePage() {
  const {
    settings,
    featured,
    newIn,
    bestSellers,
    catalogError,
    categoryTiles,
    featuredCollection,
    deliveredCount,
    spotlight,
    t,
  } = await getHomeData();
  const hasCatalog = featured.length > 0 || newIn.length > 0 || bestSellers.length > 0;

  const blocks: Record<string, React.ReactNode> = {
    featured: hasCatalog ? (
      <div className="section-space pt-4 md:pt-12">
        <ProductCarousel
          title={t.home.featuredTitle}
          products={featured}
          viewAllHref="/shop"
          mobileGrid
        />
      </div>
    ) : null,
    spotlight: spotlight ? (
      <div className="section-space pt-0">
        <ProductSpotlight product={spotlight} />
      </div>
    ) : null,
    featuredCollection: featuredCollection ? (
      <div className="section-space pt-0">
        <FeaturedCollection
          title={featuredCollection.name}
          description={featuredCollection.description ?? ""}
          image={featuredCollection.image}
          href={`/collections/${featuredCollection.slug}`}
          cta={`${t.home.collectionCta} ${featuredCollection.name}`}
        />
      </div>
    ) : null,
    bestSellers: (
      <div className="section-space pt-0">
        <ProductCarousel
          eyebrow={t.home.bestSellersEyebrow}
          title={t.home.bestSellersTitle}
          products={bestSellers}
          viewAllHref="/collections/best-sellers"
          mobileGrid
        />
      </div>
    ),
    newIn: (
      <div className="section-space pt-0">
        <ProductCarousel
          eyebrow={t.home.newInEyebrow}
          title={t.home.newInTitle}
          products={newIn}
          viewAllHref="/collections/new-in"
          mobileGrid
        />
      </div>
    ),
    categories: (
      <div className="section-space pt-0">
        <CategoryGrid categories={categoryTiles} />
      </div>
    ),
    trust: <TrustBar />,
    socialProof: settings.homepage.showSocialProof ? (
      <SocialProof deliveredCount={deliveredCount} />
    ) : null,
    faq: null,
  };
  const visibleSections = settings.homepage.sections.filter((entry) => entry.visible);

  return (
    <div className="flex flex-col gap-0">
      <Hero hero={settings.homepage.hero} />

      {!hasCatalog ? (
        <section
          className="container-luxe section-space pt-0 text-center"
          aria-labelledby="catalog-empty-title"
        >
          <div className="border-y hairline bg-cream/60 px-6 py-14 md:py-20">
            <p className="eyebrow">
              {catalogError ? t.home.emptyErrorEyebrow : t.home.emptyEyebrow}
            </p>
            <h2
              id="catalog-empty-title"
              className="mt-3 font-display text-3xl font-medium md:text-4xl"
            >
              {catalogError ? t.home.emptyErrorTitle : t.home.emptyTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-ink-soft">
              {catalogError ? t.home.emptyErrorHint : t.home.emptyHint}
            </p>
            {catalogError && (
              <Link href="/" className="btn btn-outline mt-6">
                {t.common.retry}
              </Link>
            )}
          </div>
        </section>
      ) : (
        <>
          {visibleSections.map((entry) => (
            <Fragment key={entry.id}>{blocks[entry.id]}</Fragment>
          ))}
        </>
      )}

      <section className="container-luxe pb-1 pt-2 text-center md:pb-1 md:pt-2">
        <Link
          href="/shop"
          className="text-[0.62rem] font-medium uppercase tracking-[0.16em] underline underline-offset-4 md:text-xs md:tracking-[0.24em] md:underline-offset-8"
        >
          {t.home.shopAllLink}
        </Link>
      </section>
    </div>
  );
}
