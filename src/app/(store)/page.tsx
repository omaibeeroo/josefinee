import Link from "next/link";
import type { Metadata } from "next";
import { Fragment } from "react";
import { getSettings } from "@/lib/settings";
import {
  getBestSellers,
  getFeaturedProducts,
  getNewInProducts,
  getStorefrontProducts,
} from "@/server/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import {
  CategoryGrid,
  FeaturedCollection,
  Hero,
  ProductSpotlight,
  SocialProof,
  TrustBar,
} from "@/components/storefront/home";
import { ProductCarousel } from "@/components/storefront/product";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    description: settings.seo.defaultDescription,
  };
}

async function getHomeData() {
  // Settings first (React-cached single-row reads), then one catalog wave
  // sized by the Admin → Vitrine display density knobs. Only the
  // featured-collection lookup waits on settings below.
  const settings = await getSettings();
  const display = settings.homepage.display;
  const [
    featuredResult,
    newInResult,
    bestSellersResult,
    categoriesResult,
    deliveredResult,
  ] = await Promise.all([
    getFeaturedProducts(display.featuredCount).then(
      (value) => ({ status: "fulfilled" as const, value }),
      () => ({ status: "rejected" as const, value: [] }),
    ),
    getNewInProducts(display.newInCount).then(
      (value) => ({ status: "fulfilled" as const, value }),
      () => ({ status: "rejected" as const, value: [] }),
    ),
    getBestSellers(display.bestSellersCount).then(
      (value) => ({ status: "fulfilled" as const, value }),
      () => ({ status: "rejected" as const, value: [] }),
    ),
    prisma.category
      .findMany({
        where: { isActive: true, parentId: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          name: true,
          slug: true,
          image: true,
          _count: { select: { products: { where: { status: "ACTIVE" } } } },
        },
        take: display.categoryCount,
      })
      .then(
        (value) => ({ status: "fulfilled" as const, value }),
        (error: unknown) => {
          console.error("[home] data failed", error instanceof Error ? error.name : "unknown");
          return {
            status: "rejected" as const,
            value: [] as Array<{
              name: string;
              slug: string;
              image: string | null;
              _count: { products: number };
            }>,
          };
        },
      ),
    prisma.order.count({ where: { status: "DELIVERED" } }).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error: unknown) => {
        console.error("[home] data failed", error instanceof Error ? error.name : "unknown");
        return { status: "rejected" as const, value: 0 };
      },
    ),
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

  const categoryTiles: Array<{ name: string; slug: string; image: string | null; count: number }> =
    categoriesResult.status === "fulfilled"
      ? categoriesResult.value.map((category) => ({
          name: category.name,
          slug: category.slug,
          image: category.image,
          count: category._count.products,
        }))
      : [];
  let featuredCollection: {
    name: string;
    slug: string;
    description: string | null;
    image: string | null;
  } | null = null;
  try {
    featuredCollection = await prisma.collection.findFirst({
      where: { slug: settings.homepage.featuredCollectionSlug, isActive: true },
      select: { name: true, slug: true, description: true, image: true },
    });
  } catch (error) {
    console.error("[home] data failed", error instanceof Error ? error.name : "unknown");
  }
  const deliveredCount =
    settings.homepage.socialProofOverride > 0
      ? settings.homepage.socialProofOverride
      : deliveredResult.value;
  const t = await getDictionary();

  // Hand-picked spotlight product from Admin → Vitrine, else first featured.
  let spotlight = featured[0] ?? null;
  const spotlightId = settings.homepage.spotlightProductId;
  if (spotlightId) {
    try {
      const picked = await getStorefrontProducts({ ids: [spotlightId], pageSize: 1 });
      if (picked.items[0]) spotlight = picked.items[0];
    } catch (error) {
      console.error("[home] spotlight failed", error instanceof Error ? error.name : "unknown");
    }
  }

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
      <div className="section-space pt-0">
        <ProductCarousel
          eyebrow={t.home.featuredEyebrow}
          title={t.home.featuredTitle}
          products={featured}
          viewAllHref="/shop"
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

      <section className="container-luxe pb-2 pt-3 text-center md:pb-3 md:pt-4">
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
