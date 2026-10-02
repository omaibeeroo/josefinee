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
  FaqTeaser,
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
  let faqs: Array<{ question: string; answer: string }> = [];

  try {
    const [categories, collection, delivered, faqItems] = await Promise.all([
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
      prisma.faqItem.findMany({
        where: { isPublished: true },
        orderBy: [{ sortOrder: "asc" }],
        select: { question: true, answer: true },
        take: 5,
      }),
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
    faqs = faqItems;
  } catch (error) {
    console.error("[home] data failed", error);
  }

  return { settings, featured, newIn, bestSellers, categoryTiles, featuredCollection, deliveredCount, faqs };
}

export default async function HomePage() {
  const { settings, featured, newIn, bestSellers, categoryTiles, featuredCollection, deliveredCount, faqs } =
    await getHomeData();

  return (
    <div className="flex flex-col gap-0">
      <Hero hero={settings.homepage.hero} />

      <TrustBar />

      {featuredCollection && (
        <div className="section-space">
          <FeaturedCollection
            title={featuredCollection.name}
            description={featuredCollection.description ?? ""}
            image={featuredCollection.image}
            href={`/collections/${featuredCollection.slug}`}
            cta={`Shop ${featuredCollection.name}`}
          />
        </div>
      )}

      <div className="section-space pt-0">
        <ProductCarousel
          eyebrow="Handpicked"
          title="Choose your jewellery"
          products={featured}
          viewAllHref="/shop"
        />
      </div>

      <div className="section-space pt-0">
        <ProductCarousel
          eyebrow="Loved by customers"
          title="Our best sellers"
          products={bestSellers}
          viewAllHref="/collections/best-sellers"
        />
      </div>

      <div className="section-space pt-0">
        <ProductCarousel
          eyebrow="Just landed"
          title="New in"
          products={newIn}
          viewAllHref="/collections/new-in"
        />
      </div>

      <div className="section-space pt-0">
        <CategoryGrid categories={categoryTiles} />
      </div>

      {settings.homepage.showSocialProof && <SocialProof deliveredCount={deliveredCount} />}

      <div className="section-space">
        <Pillars items={settings.homepage.pillars} />
      </div>

      <div className="section-space pt-0">
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
          Shop all products
        </Link>
      </section>
    </div>
  );
}
