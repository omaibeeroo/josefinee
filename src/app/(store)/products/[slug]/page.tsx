import type { Metadata } from "next";
import { cache } from "react";
import { after } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getProductBySlug, getRelatedProducts } from "@/server/catalog";
import { getProductPromotion } from "@/server/promotions";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";
import { getSettings } from "@/lib/settings";
import {
  AddToBagPanel,
  ProductGallery,
  ProductCarousel,
  RecentlyViewed,
} from "@/components/storefront/product";
import { Accordion, Stars } from "@/components/ui";
import { PixelEvent } from "@/components/pixels";
import { ReviewForm } from "./reviews";
import { serializeForInlineJsonScript } from "@/lib/script-data";
import { cleanRichText } from "@/lib/sanitize";

const getCachedProductBySlug = cache((slug: string) => getProductBySlug(slug));

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);
  if (!product) notFound();
  const settings = await getSettings();
  return {
    title: product.seoTitle || product.name,
    description:
      product.seoDescription || product.shortDescription || settings.seo.defaultDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.shortDescription ?? undefined,
      type: "website",
      images: product.images[0]?.url ? [{ url: product.images[0].url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.seoTitle || product.name,
      description: product.seoDescription || product.shortDescription || undefined,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

async function getReviews(productId: string) {
  try {
    return await prisma.review.findMany({
      where: { productId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        authorName: true,
        rating: true,
        title: true,
        body: true,
        createdAt: true,
        isVerifiedPurchase: true,
      },
      take: 20,
    });
  } catch {
    return [];
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getCachedProductBySlug(slug);
  if (!product) notFound();

  const [settings, requestHeaders] = await Promise.all([getSettings(), headers()]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const [related, reviews, promotion] = await Promise.all([
    getRelatedProducts(
      product.id,
      product.category ? await categoryIdOf(product.category.slug) : null,
    ),
    getReviews(product.id),
    getProductPromotion(product.id, product.collectionIds),
  ]);
  after(() =>
    trackEvent({
      name: ANALYTICS_EVENTS.PRODUCT_VIEW,
      props: { productId: product.id, slug: product.slug, price: product.price },
    }),
  );

  const firstImage = product.images[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? undefined,
    sku: product.sku ?? undefined,
    image: firstImage?.url ? [firstImage.url] : undefined,
    brand: { "@type": "Brand", name: settings.general.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "DZD",
      price: product.price,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAvg,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  const detailRows: Array<[string, string | null]> = [
    ["Material", product.material],
    ["Color", product.color],
    ["Dimensions", product.dimensions],
    ["Weight", product.weight ? `${product.weight} g` : null],
  ];

  return (
    <div className="product-detail-page container-luxe py-8 md:py-12">
      <PixelEvent
        name="ViewContent"
        params={{
          content_ids: [product.id],
          content_type: "product",
          value: product.price,
          currency: "DZD",
        }}
      />
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeForInlineJsonScript(jsonLd) }}
      />

      <nav
        aria-label="Breadcrumb"
        className="mb-6 text-xs uppercase tracking-[0.14em] text-ink-muted"
      >
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        {product.category ? (
          <>
            <Link href={`/categories/${product.category.slug}`} className="hover:text-ink">
              {product.category.name}
            </Link>
            <span aria-hidden="true"> / </span>
          </>
        ) : null}
        <span aria-current="page" className="text-ink">
          {product.name}
        </span>
      </nav>

      <div className="product-detail-layout grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.92fr)] lg:gap-16">
        <div className="product-detail-gallery lg:sticky lg:top-24 lg:self-start">
          <ProductGallery images={product.images} name={product.name} />
        </div>

        <div className="product-detail-info">
          {product.category && <p className="eyebrow mb-3">{product.category.name}</p>}
          <h1 className="product-detail-title font-display text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            {product.name}
          </h1>
          {product.ratingCount > 0 && (
            <div className="mt-3">
              <Stars value={product.ratingAvg} count={product.ratingCount} />
            </div>
          )}
          <p className="mt-2 flex items-center gap-2 text-sm" role="status">
            {product.inStock ? (
              <>
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                <span className="font-medium">In stock, ready to ship</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-sale" aria-hidden="true" />
                <span className="font-medium text-sale">Sold out — check back soon</span>
              </>
            )}
          </p>
          {promotion && (
            <p
              className="mt-2 inline-block bg-gold/15 px-3 py-1.5 text-sm font-medium text-gold-dark"
              role="status"
            >
              {promotion.type === "PERCENTAGE"
                ? `${promotion.value}% off`
                : `${promotion.value} DA off`}{" "}
              with {promotion.name} — applied automatically at checkout
            </p>
          )}
          {product.shortDescription && (
            <p className="mt-4 leading-relaxed text-ink-soft">{product.shortDescription}</p>
          )}

          <div className="product-purchase-panel">
            <AddToBagPanel product={product} />
          </div>

          <dl className="mt-7 grid grid-cols-1 gap-3 border-t hairline pt-6 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Banknote
                size={18}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0 text-gold-dark"
                aria-hidden="true"
              />
              <div>
                <dt className="font-medium">Cash on delivery</dt>
                <dd className="text-ink-soft">Pay when your order arrives.</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Truck
                size={18}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0 text-gold-dark"
                aria-hidden="true"
              />
              <div>
                <dt className="font-medium">58 wilayas</dt>
                <dd className="text-ink-soft">Delivery calculated at checkout.</dd>
              </div>
            </div>
          </dl>

          <div className="mt-6">
            <Accordion
              items={[
                ...(product.description
                  ? [
                      {
                        title: "Description",
                        defaultOpen: true,
                        content: (
                          <div
                            className="rich-text"
                            dangerouslySetInnerHTML={{ __html: cleanRichText(product.description) }}
                          />
                        ),
                      },
                    ]
                  : []),
                ...(detailRows.some(([, value]) => value)
                  ? [
                      {
                        title: "Details",
                        content: (
                          <dl className="space-y-2 text-sm">
                            {detailRows
                              .filter(([, value]) => value)
                              .map(([label, value]) => (
                                <div key={label} className="flex gap-3">
                                  <dt className="w-28 shrink-0 uppercase tracking-[0.1em] text-ink-muted">
                                    {label}
                                  </dt>
                                  <dd>{value}</dd>
                                </div>
                              ))}
                          </dl>
                        ),
                      },
                    ]
                  : []),
                ...(product.careInstructions
                  ? [
                      {
                        title: "Care",
                        content: <p className="rich-text">{product.careInstructions}</p>,
                      },
                    ]
                  : []),
                {
                  title: "Shipping & returns",
                  content: (
                    <div className="rich-text">
                      <p>
                        {product.shippingInfo ??
                          "We deliver to all 58 wilayas. Fees and timing are shown at checkout."}{" "}
                        <Link href="/pages/shipping" className="underline underline-offset-2">
                          Delivery information
                        </Link>
                        {" · "}
                        <Link href="/pages/returns" className="underline underline-offset-2">
                          Returns within 7 days
                        </Link>
                      </p>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>

      <section className="mt-16 md:mt-24" aria-label="Reviews">
        <h2 className="font-display text-3xl font-medium">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-ink-soft">
            No reviews yet — be the first to share your thoughts.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {reviews.map((review) => (
              <li key={review.id} className="border hairline bg-white p-5">
                <Stars value={review.rating} />
                {review.title && <p className="mt-2 font-medium">{review.title}</p>}
                <p className="mt-1 text-[0.9375rem] text-ink-soft">{review.body}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.12em] text-ink-muted">
                  {review.authorName}
                  {review.isVerifiedPurchase ? " · Verified purchase" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <ReviewForm productId={product.id} />
      </section>

      <div className="mt-16 md:mt-24">
        <ProductCarousel title="You may also like" products={related} viewAllHref="/shop" />
      </div>

      <div className="mt-12 md:mt-16">
        <RecentlyViewed productId={product.id} />
      </div>
    </div>
  );
}

async function categoryIdOf(slug: string): Promise<string | null> {
  const category = await prisma.category
    .findUnique({ where: { slug }, select: { id: true } })
    .catch(() => null);
  return category?.id ?? null;
}
