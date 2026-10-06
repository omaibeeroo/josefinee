import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getBestSellers, getFeaturedProducts, getNewInProducts } from "@/server/catalog";
import { prisma } from "@/lib/prisma";
import {
  CategoryGrid,
  DiscoveryStrip,
  FaqTeaser,
  FeaturedCollection,
  Hero,
  NewsletterSection,
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
  // One wave: settings, catalog trio, and every settings-independent Prisma read
  // launch together. Only the featured-collection lookup waits on settings.
  const [
    settings,
    featuredResult,
    newInResult,
    bestSellersResult,
    categoriesResult,
    deliveredResult,
    faqResult,
  ] = await Promise.all([
    getSettings(),
    getFeaturedProducts(10).then(
      (value) => ({ status: "fulfilled" as const, value }),
      () => ({ status: "rejected" as const, value: [] }),
    ),
    getNewInProducts(10).then(
      (value) => ({ status: "fulfilled" as const, value }),
      () => ({ status: "rejected" as const, value: [] }),
    ),
    getBestSellers(10).then(
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
        take: 6,
      })
      .then(
        (value) => ({ status: "fulfilled" as const, value }),
        (error: unknown) => {
          console.error("[home] data failed", error instanceof Error ? error.name : "unknown");
          return { status: "rejected" as const, value: [] as Array<{ name: string; slug: string; image: string | null; _count: { products: number } }> };
        },
      ),
    prisma.order
      .count({ where: { status: "DELIVERED" } })
      .then(
        (value) => ({ status: "fulfilled" as const, value }),
        (error: unknown) => {
          console.error("[home] data failed", error instanceof Error ? error.name : "unknown");
          return { status: "rejected" as const, value: 0 };
        },
      ),
    prisma.faqItem
      .findMany({
        where: { isPublished: true },
        orderBy: [{ sortOrder: "asc" }],
        select: { question: true, answer: true },
        take: 5,
      })
      .then(
        (value) => ({ status: "fulfilled" as const, value }),
        (error: unknown) => {
          console.error("[home] data failed", error instanceof Error ? error.name : "unknown");
          return { status: "rejected" as const, value: [] as Array<{ question: string; answer: string }> };
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
  const faqs = faqResult.value;

  return {
    settings,
    featured,
    newIn,
    bestSellers,
    catalogError,
    categoryTiles,
    featuredCollection,
    deliveredCount,
    faqs,
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
    faqs,
  } = await getHomeData();

  return (
    <div className="flex flex-col gap-0">
      <Hero hero={settings.homepage.hero} />

      <DiscoveryStrip />

      {featured.length === 0 && newIn.length === 0 && bestSellers.length === 0 ? (
        <section
          className="container-luxe section-space pt-0 text-center"
          aria-labelledby="catalog-empty-title"
        >
          <div className="border-y hairline bg-cream/60 px-6 py-14 md:py-20">
            <p className="eyebrow">
              {catalogError ? "Service momentanément indisponible" : "Bientôt disponible"}
            </p>
            <h2
              id="catalog-empty-title"
              className="mt-3 font-display text-3xl font-medium md:text-4xl"
            >
              {catalogError
                ? "Impossible de charger la sélection"
                : "Nos nouveautés arrivent bientôt"}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-ink-soft">
              {catalogError
                ? "Un problème temporaire empêche l’affichage des produits. Veuillez réessayer dans quelques instants."
                : "La boutique prépare actuellement sa première sélection. Inscrivez-vous pour être informée des nouveautés."}
            </p>
            {catalogError && (
              <Link href="/" className="btn btn-outline mt-6">
                Réessayer
              </Link>
            )}
          </div>
        </section>
      ) : (
        <div className="section-space pt-0">
          <ProductCarousel
            eyebrow="Choisissez votre prochaine pièce"
            title="La sélection Hanadi Store"
            products={featured}
            viewAllHref="/shop"
          />
        </div>
      )}

      {featured[0] && (
        <div className="section-space pt-0">
          <ProductSpotlight product={featured[0]} />
        </div>
      )}

      {featuredCollection && (
        <div className="section-space pt-0">
          <FeaturedCollection
            title={featuredCollection.name}
            description={featuredCollection.description ?? ""}
            image={featuredCollection.image}
            href={`/collections/${featuredCollection.slug}`}
            cta={`Découvrir ${featuredCollection.name}`}
          />
        </div>
      )}

      <div className="section-space pt-0">
        <ProductCarousel
          eyebrow="Plébiscités par nos clientes"
          title="Meilleures ventes"
          products={bestSellers}
          viewAllHref="/collections/best-sellers"
        />
      </div>

      <div className="section-space pt-0">
        <ProductCarousel
          eyebrow="Tout juste arrivés"
          title="Nouveautés"
          products={newIn}
          viewAllHref="/collections/new-in"
        />
      </div>

      <div className="section-space pt-0">
        <CategoryGrid categories={categoryTiles} />
      </div>

      <TrustBar />

      {settings.homepage.showSocialProof && <SocialProof deliveredCount={deliveredCount} />}

      <div className="section-space pb-4 pt-0 md:pb-6">
        <FaqTeaser items={faqs} />
      </div>

      <div className="section-space pt-0">
        <NewsletterSection />
      </div>

      <section className="container-luxe pb-4 text-center">
        <Link
          href="/shop"
          className="text-xs font-medium uppercase tracking-[0.24em] underline underline-offset-8"
        >
          Découvrir tous les produits
        </Link>
      </section>
    </div>
  );
}
