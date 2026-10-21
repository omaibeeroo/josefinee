import type { Metadata } from "next";
import { cache } from "react";
import { after } from "next/server";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, Truck } from "lucide-react";
import { getProductBySlug, getRelatedProducts } from "@/server/catalog";
import { getProductPromotion } from "@/server/promotions";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";
import { getSettings } from "@/lib/settings";
import { AddToBagPanel, ProductGallery, ProductCarousel } from "@/components/storefront/product";
import { Accordion, SingleStar } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/server";
import { PixelEvent } from "@/components/pixels";
import { serializeForInlineJsonScript } from "@/lib/script-data";
import { cleanRichText } from "@/lib/sanitize";
import { formatDA } from "@/lib/money";
import { appUrl } from "@/config/brand";
import { cn } from "@/lib/utils";

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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Single parallel round: product, settings, nonce headers and dictionary
  // never depend on each other.
  const [product, settings, requestHeaders, t] = await Promise.all([
    getCachedProductBySlug(slug),
    getSettings(),
    headers(),
    getDictionary(),
  ]);
  if (!product) notFound();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const [related, promotion] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId),
    getProductPromotion(product.id, product.collectionIds, product.price),
  ]);
  after(() =>
    trackEvent({
      name: ANALYTICS_EVENTS.PRODUCT_VIEW,
      props: { productId: product.id, slug: product.slug, price: product.price },
    }),
  );

  const firstImage = product.images[0];
  // JSON-LD requires absolute image URLs; absolutize app-relative upload paths.
  const firstImageUrl = firstImage?.url
    ? firstImage.url.startsWith("/")
      ? `${appUrl()}${firstImage.url}`
      : firstImage.url
    : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? undefined,
    sku: product.sku ?? undefined,
    image: firstImageUrl ? [firstImageUrl] : undefined,
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
    [t.product.material, product.material],
    [t.product.color, product.color],
    [t.product.dimensions, product.dimensions],
    [t.product.weight, product.weight ? `${product.weight} g` : null],
  ];

  return (
    <div className="product-detail-page container-luxe py-5 md:py-12">
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
        aria-label={t.product.breadcrumb}
        className="mb-4 text-xs uppercase tracking-[0.14em] text-ink-muted md:mb-6"
      >
        <Link href="/" className="hover:text-ink">
          {t.product.home}
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

      <div className="product-detail-layout grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.92fr)] lg:gap-16">
        <div className="product-detail-gallery lg:sticky lg:top-24 lg:self-start">
          <ProductGallery images={product.images} name={product.name} />
        </div>

        <div className="product-detail-info">
          {product.category && <p className="eyebrow mb-2 md:mb-3">{product.category.name}</p>}
          <div className="product-detail-heading flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <h1 className="product-detail-title min-w-0 font-display text-3xl font-medium leading-[1.05] tracking-tight md:text-6xl">
                {product.name}
              </h1>
              {product.ratingCount > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#dce1e6] bg-white/75 px-2.5 py-1 text-xs">
                  <SingleStar value={product.ratingAvg} />
                  <span className="text-ink-muted">({product.ratingCount})</span>
                </span>
              )}
            </div>
            <p
              className="product-detail-status ms-auto mt-1 flex shrink-0 items-center gap-1.5 text-xs font-medium md:mt-2 md:text-sm"
              role="status"
            >
              <span
                className={cn("h-2 w-2 rounded-full", product.inStock ? "bg-success" : "bg-sale")}
                aria-hidden="true"
              />
              <span className={cn(!product.inStock && "text-sale")}>
                {product.inStock ? t.product.inStockReady : t.product.soldOutSoon}
              </span>
            </p>
          </div>
          {promotion && (
            <p
              className="mt-2 inline-block bg-gold/15 px-3 py-1.5 text-sm font-medium text-gold-dark"
              role="status"
            >
              {promotion.type === "PERCENTAGE"
                ? t.product.promoPercent.replace("{value}", String(promotion.value))
                : t.product.promoFixed.replace("{value}", formatDA(promotion.value, t.locale))}{" "}
              {t.product.promoWith.replace("{name}", promotion.name)}
            </p>
          )}
          <div className="product-purchase-panel">
            <AddToBagPanel
              product={product}
              freeDeliveryThreshold={settings.commerce.freeDeliveryThreshold}
              defaultDeliveryMethod={settings.commerce.defaultDeliveryMethod}
            />
          </div>

          <dl className="product-fulfillment mt-5 grid grid-cols-2 gap-3 border-t hairline pt-4 text-sm md:mt-7 md:pt-6">
            <div className="flex items-start gap-3">
              <Banknote
                size={18}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0 text-gold-dark"
                aria-hidden="true"
              />
              <div>
                <dt className="font-medium">{t.product.codTitle}</dt>
                <dd className="text-ink-soft">{t.product.codText}</dd>
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
                <dt className="font-medium">{t.product.wilayas58}</dt>
                <dd className="text-ink-soft">{t.product.shippingAtCheckout}</dd>
              </div>
            </div>
          </dl>

          <div className="mt-6">
            <Accordion
              items={[
                ...(product.description
                  ? [
                      {
                        title: t.product.description,
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
                        title: t.product.details,
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
                        title: t.product.care,
                        content: <p className="rich-text">{product.careInstructions}</p>,
                      },
                    ]
                  : []),
                {
                  title: t.product.shippingReturns,
                  content: (
                    <div className="rich-text">
                      <p>
                        {product.shippingInfo ?? t.product.shippingFallback}{" "}
                        <Link href="/pages/shipping" className="underline underline-offset-2">
                          {t.product.shippingInfo}
                        </Link>
                        {" · "}
                        <Link href="/pages/returns" className="underline underline-offset-2">
                          {t.product.returns7}
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

      <div className="mt-10 md:mt-14">
        <ProductCarousel title={t.product.alsoLike} products={related} viewAllHref="/shop" />
      </div>
    </div>
  );
}
