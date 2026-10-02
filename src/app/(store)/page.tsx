import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import {
  getBestSellers,
  getFeaturedProducts,
  getNewInProducts,
} from "@/server/catalog";
import { prisma } from "@/lib/prisma";
import {
  CategoryGrid,
  Editorial,
  FeaturedCollection,
  Hero,
  NewsletterSection,
  Pillars,
  SocialProof,
  TrustBar,
} from "@/components/storefront/home";
import { ProductCarousel } from "@/components/storefront/product";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    description: settings.seo.defaultDescription,
  };
}

async function getHomeData() {
  const [settings, featured, newIn, bestSellers] = await Promise.all([
    getSettings(),
    getFeaturedProducts(10),
    getNewInProducts(10),
    getBestSellers(10),
  ]);

  let categoryTiles: Array<{ name: string; slug: string; image: string | null; count: number }> = [];
  let featuredCollection: { name: string; slug: string; description: string | null; image: string | null } | null = null;
  let deliveredCount = 0;

  try {
    const [categories, collection, delivered] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true, parentId: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          name: true,
          slug: true,
          image: true,
          _count: { select: { products: { where: { status: "ACTIVE" } } } },
        },
        take: 6,
      }),
      prisma.collection.findFirst({
        where: { slug: settings.homepage.featuredCollectionSlug, isActive: true },
        select: { name: true, slug: true, description: true, image: true },
      }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
    ]);
    categoryTiles = categories.map((category) => ({
      name: category.name,
      slug: category.slug,
      image: category.image,
      count: category._count.products,
    }));
    featuredCollection = collection;
    deliveredCount = settings.homepage.socialProofOverride > 0
      ? settings.homepage.socialProofOverride
      : delivered;
  } catch (error) {
    console.error("[home] data failed", error);
  }

  return { settings, featured, newIn, bestSellers, categoryTiles, featuredCollection, deliveredCount };
}

export default async function HomePage() {
  const { settings, featured, newIn, bestSellers, categoryTiles, featuredCollection, deliveredCount } =
    await getHomeData();

  return (
    <div className="flex flex-col gap-12 md:gap-20">
      <Hero hero={settings.homepage.hero} />

      <TrustBar />

      {featuredCollection && (
        <FeaturedCollection
          title={featuredCollection.name}
          description={featuredCollection.description ?? ""}
          image={featuredCollection.image}
          href={`/collections/${featuredCollection.slug}`}
          cta={`Shop ${featuredCollection.name}`}
        />
      )}

      <CategoryGrid categories={categoryTiles} />

      <ProductCarousel
        eyebrow="Handpicked"
        title="Choose your jewellery"
        products={featured}
        viewAllHref="/shop"
      />

      <Editorial
        image={null}
        eyebrow="New in"
        title="Fresh pieces, weekly drops"
        text="Small-batch arrivals in gold and silver tones — when a piece sells out, it may never return. Follow the New In edit to catch this week's drop before it is gone."
        href="/collections/new-in"
        cta="Shop new in"
      />

      <ProductCarousel
        eyebrow="Just landed"
        title="New in"
        products={newIn}
        viewAllHref="/collections/new-in"
      />

      {settings.homepage.showSocialProof && <SocialProof deliveredCount={deliveredCount} />}

      <ProductCarousel
        eyebrow="Loved by customers"
        title="Our best sellers"
        products={bestSellers}
        viewAllHref="/collections/best-sellers"
      />

      <Pillars items={settings.homepage.pillars} />

      <NewsletterSection />

      <section className="container-luxe pb-4 text-center">
        <Link
          href="/shop"
          className="text-xs font-medium uppercase tracking-[0.24em] underline underline-offset-8"
        >
          Shop all products
        </Link>
      </section>
    </div>
  );
}
