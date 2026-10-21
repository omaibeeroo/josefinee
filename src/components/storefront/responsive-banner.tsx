import Image from "next/image";

export const RESPONSIVE_BANNER_ASSETS = {
  "cat-bags-wallets": {
    mobile: "/banners/cat-bags-wallets-480.webp",
    tablet: "/banners/cat-bags-wallets-768.webp",
    desktop: "/banners/cat-bags-wallets-1200.webp",
  },
  "cat-bags": {
    mobile: "/banners/cat-bags-480.webp",
    tablet: "/banners/cat-bags-768.webp",
    desktop: "/banners/cat-bags-1200.webp",
  },
  "cat-clothing": {
    mobile: "/banners/cat-clothing-480.webp",
    tablet: "/banners/cat-clothing-768.webp",
    desktop: "/banners/cat-clothing-1200.webp",
  },
  "cat-jewelry": {
    mobile: "/banners/cat-jewelry-480.webp",
    tablet: "/banners/cat-jewelry-768.webp",
    desktop: "/banners/cat-jewelry-1200.webp",
  },
  footer: {
    mobile: "/banners/footer-brand-640.webp",
    tablet: "/banners/footer-brand-960.webp",
    desktop: "/banners/footer-brand-1280.webp",
  },
} as const;

export type ResponsiveBannerAsset = keyof typeof RESPONSIVE_BANNER_ASSETS;

export function ResponsiveBannerImage({
  asset,
  alt,
  sizes,
  priority = false,
  className,
}: {
  asset: ResponsiveBannerAsset;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const sources = RESPONSIVE_BANNER_ASSETS[asset];
  return (
    <picture>
      <source media="(max-width: 639px)" srcSet={sources.mobile} />
      <source media="(max-width: 1023px)" srcSet={sources.tablet} />
      <Image
        src={sources.desktop}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className={className}
      />
    </picture>
  );
}
