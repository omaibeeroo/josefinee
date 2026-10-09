"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/provider";
import { Price, Reveal } from "@/components/ui";
import { formatNumber } from "@/lib/money";
import type { HomepageSettings } from "@/lib/settings";
import type { StoreProductCard } from "@/server/catalog";
import { ProductImage } from "@/components/storefront/product";

/* ------------------------------------------------------------------ Hero */

export function Hero({ hero }: { hero: HomepageSettings["hero"] }) {
  const { t } = useLocale();
  const hasImage = Boolean(hero.imageDesktop);
  return (
    <section className="relative overflow-hidden bg-cream" aria-label={t.home.heroFeatured}>
      {hasImage ? (
        <>
          <div className="relative aspect-[4/5] w-full sm:aspect-[16/10] md:aspect-[21/9]">
              <Image
                src={hero.imageMobile || hero.imageDesktop}
                alt={hero.headline}
                fill
                priority
                fetchPriority="high"
                unoptimized
                sizes="100vw"
                className="object-cover motion-safe:animate-hero-image"
              />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 pb-10 md:pb-16">
            {/* Hero copy always anchors left (even in RTL): inner text keeps
                its own bidi direction, so Arabic still reads correctly. */}
            <div className="container-luxe overlay-text" dir="ltr" style={{ textAlign: "left" }}>
              <p
                className="eyebrow overlay-text-soft motion-safe:animate-hero-enter motion-safe:opacity-0"
                style={{ animationDelay: "60ms" }}
              >
                {hero.eyebrow}
              </p>
              <h1
                className="mt-3 max-w-2xl font-display text-4xl font-medium leading-[1.05] motion-safe:animate-hero-enter motion-safe:opacity-0 md:text-6xl"
                style={{ animationDelay: "120ms" }}
              >
                {hero.headline}
              </h1>
              <p
                className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed overlay-text-faint motion-safe:animate-hero-enter motion-safe:opacity-0"
                style={{ animationDelay: "180ms" }}
              >
                {hero.subheading}
              </p>
              <div
                className="mt-6 flex flex-wrap gap-3 motion-safe:animate-hero-enter motion-safe:opacity-0"
                style={{ animationDelay: "240ms" }}
              >
                <Link
                  href={hero.primaryHref}
                  className="btn btn-shine bg-ivory text-ink hover:bg-white"
                >
                  {hero.primaryLabel}
                </Link>
                <Link
                  href={hero.secondaryHref}
                  className="btn border border-[#fff]/70 text-[#fff] hover:bg-[#fff] hover:text-[#1d232b]"
                >
                  {hero.secondaryLabel}
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="container-luxe py-10 text-center md:py-16">
          <p
            className="eyebrow motion-safe:animate-hero-enter motion-safe:opacity-0"
            style={{ animationDelay: "60ms" }}
          >
            {hero.eyebrow}
          </p>
          <h1
            className="mx-auto mt-4 max-w-3xl font-display text-5xl font-medium leading-[1.05] motion-safe:animate-hero-enter motion-safe:opacity-0 md:text-7xl"
            style={{ animationDelay: "120ms" }}
          >
            {hero.headline}
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl text-ink-soft motion-safe:animate-hero-enter motion-safe:opacity-0"
            style={{ animationDelay: "180ms" }}
          >
            {hero.subheading}
          </p>
          <div
            className="mt-8 flex flex-wrap justify-center gap-3 motion-safe:animate-hero-enter motion-safe:opacity-0"
            style={{ animationDelay: "240ms" }}
          >
            <Link href={hero.primaryHref} className="btn btn-primary btn-shine">
              {hero.primaryLabel}
            </Link>
            <Link href={hero.secondaryHref} className="btn btn-outline">
              {hero.secondaryLabel}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------ Featured block */

export function FeaturedCollection({
  title,
  description,
  image,
  href,
  cta,
}: {
  title: string;
  description: string;
  image: string | null;
  href: string;
  cta: string;
}) {
  const { t } = useLocale();
  return (
    <section className="container-luxe" aria-label={title}>
      <Reveal>
        <Link
          href={href}
          className="group relative block overflow-hidden bg-cream transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-30px_rgb(29_35_43/0.45)]"
        >
          <div
            className={
              image
                ? "relative aspect-[16/10] w-full md:aspect-[21/8]"
                : "relative min-h-[18rem] w-full md:min-h-[22rem]"
            }
          >
            {image ? (
              <Image
                src={image}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                unoptimized
                className="editorial-image object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-display text-6xl text-ink-muted/50 md:text-8xl">
                  {title.charAt(0)}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-6 overlay-text md:p-10">
              <p className="eyebrow overlay-text-soft">{t.home.collectionToDiscover}</p>
              <h2 className="font-display text-4xl font-medium md:text-5xl">{title}</h2>
              <p className="max-w-lg text-sm overlay-text-faint md:text-base">{description}</p>
              <span className="btn mt-3 bg-[#fbfcfd] text-[#1d232b] hover:bg-[#fff]">
                {cta} <ArrowRight size={15} className="rtl-flip" />
              </span>
            </div>
          </div>
        </Link>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------ Product spotlight */

export function ProductSpotlight({ product }: { product: StoreProductCard }) {
  const { t } = useLocale();
  const image = product.images[0];

  return (
    <section className="container-luxe" aria-label={`${t.home.signatureEyebrow} : ${product.name}`}>
      <div className="feature-spotlight grid overflow-hidden bg-white md:grid-cols-[1.08fr_0.92fr]">
        <div className="relative aspect-[4/5] bg-cream md:aspect-auto md:min-h-[34rem]">
          <ProductImage
            url={image?.url ?? null}
            alt={product.name}
            sizes="(max-width: 768px) 100vw, 55vw"
            className="feature-spotlight-image"
          />
        </div>
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 md:px-14 md:py-14">
          <p className="eyebrow">{t.home.signatureEyebrow}</p>
          <p className="mt-7 text-[0.625rem] uppercase tracking-[0.28em] text-ink-muted">
            Hanadi Store / {t.home.selectionLabel}
          </p>
          <h2 className="mt-3 max-w-md font-display text-4xl font-medium leading-[1.02] md:text-5xl">
            {product.name}
          </h2>
          <div className="mt-5 text-base text-ink-soft">
            <Price price={product.price} compareAt={product.compareAtPrice} />
          </div>
          <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">
            {t.home.spotlightText}
          </p>
          <Link href={`/products/${product.slug}`} className="btn btn-primary btn-shine mt-8 w-fit">
            {t.home.discoverPiece} <ArrowRight size={15} className="rtl-flip" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- Category grid */

export type CategoryTile = { name: string; slug: string; image: string | null; count: number };

/** Editorial placeholders so a category tile never renders empty. */
const CATEGORY_PLACEHOLDERS = [
  "/banners/cat-bags.webp",
  "/banners/cat-jewelry.webp",
  "/banners/cat-bags-wallets.webp",
  "/banners/cat-clothing.webp",
];

export function CategoryGrid({ categories }: { categories: CategoryTile[] }) {
  const { t } = useLocale();
  if (categories.length === 0) return null;
  return (
    <section className="container-luxe" aria-label={t.home.shopByCategory}>
      <Reveal>
        <div className="mb-4 flex items-end justify-between gap-6 md:mb-6">
          <div>
            <p className="eyebrow mb-2">{t.home.forYou}</p>
            <h2 className="font-display text-3xl font-medium uppercase md:text-4xl">
              {t.home.shopByCategory}
            </h2>
          </div>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-ink-muted sm:block">
            {t.home.wardobeNote}
          </span>
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {categories.map((category, index) => {
          const image = category.image ?? CATEGORY_PLACEHOLDERS[index % CATEGORY_PLACEHOLDERS.length]!;
          return (
          <Reveal key={category.slug} delay={Math.min(index, 5) * 70}>
            <Link
              href={`/categories/${category.slug}`}
              className="group relative block overflow-hidden bg-cream transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-30px_rgb(29_35_43/0.45)]"
            >
              <div className="relative aspect-[3/4] w-full">
                <Image
                  src={image}
                  alt={category.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 16vw"
                  unoptimized
                  className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 overlay-text md:p-4">
                  <p className="text-sm font-medium md:text-base">{category.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[0.6875rem] uppercase tracking-[0.16em] overlay-text-soft">
                    {t.home.discover} <ArrowRight size={12} className="rtl-flip" />
                  </p>
                </div>
              </div>
            </Link>
          </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Trust bar */

function useTrustItems() {
  const { t } = useLocale();
  return [
    { title: t.home.trustFast, text: t.home.trustFastDetail },
    { title: t.home.trustCod, text: t.home.trustCodDetail },
    { title: t.home.trustPack, text: t.home.trustPackDetail },
  ];
}

export function TrustBar() {
  const { t } = useLocale();
  const items = useTrustItems();
  return (
    <section aria-label={t.home.whyUs}>
      <div className="container-luxe grid grid-cols-3 gap-0 divide-x divide-[var(--color-line)] py-2 text-center">
        {items.map((item) => (
          <div key={item.title} className="min-w-0 px-1.5 sm:px-6">
            <p className="text-[0.52rem] font-medium uppercase leading-tight tracking-[0.07em] sm:text-[0.7rem] sm:tracking-[0.2em]">
              {item.title}
            </p>
            <p className="mt-1 text-[0.65rem] leading-tight text-ink-soft sm:text-sm">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SocialProof({ deliveredCount }: { deliveredCount: number }) {
  const { t } = useLocale();
  if (deliveredCount <= 0) return null;
  return (
    <section className="bg-ink text-ivory" aria-label={t.home.trustTitle}>
      <div className="container-luxe flex flex-col items-center gap-2 py-8 text-center md:py-10">
        <p className="font-display text-5xl font-medium md:text-6xl">
          +{formatNumber(deliveredCount)}
        </p>
        <p className="text-xs uppercase tracking-[0.24em] text-ivory/70">{t.home.deliveredCount}</p>
      </div>
    </section>
  );
}

export type { StoreProductCard };
