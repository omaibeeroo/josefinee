/**
 * Central brand configuration.
 *
 * Every user-facing brand value lives here (or in the database `Setting`
 * table, which overrides these defaults at runtime). Nothing about the brand
 * should be hard-coded anywhere else in the application.
 *
 * Replace these values with your own brand identity. Images, colors and copy
 * are stored as settings so the admin can change them without a redeploy.
 */

const env = (key: string, fallback: string): string => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
};

export const BRAND_CONFIG = {
  name: env("NEXT_PUBLIC_BRAND_NAME", "NÛR"),
  legalName: env("NEXT_PUBLIC_BRAND_LEGAL_NAME", "NÛR Store"),
  tagline: env("NEXT_PUBLIC_BRAND_TAGLINE", "Pieces you will wear on repeat"),
  description: env(
    "NEXT_PUBLIC_BRAND_DESCRIPTION",
    "Modern jewelry, bags and accessories, delivered across Algeria. Pay cash on delivery.",
  ),
  orderPrefix: env("NEXT_PUBLIC_ORDER_PREFIX", "NUR"),
  currency: env("NEXT_PUBLIC_CURRENCY", "DZD"),
  currencySymbol: env("NEXT_PUBLIC_CURRENCY_SYMBOL", "DA"),
  country: env("NEXT_PUBLIC_COUNTRY", "Algeria"),
  countryCode: "DZ",
  locale: env("NEXT_PUBLIC_LOCALE", "fr-DZ"),
  supportEmail: env("NEXT_PUBLIC_SUPPORT_EMAIL", "support@example.com"),
  supportPhone: env("NEXT_PUBLIC_SUPPORT_PHONE", "0550 00 00 00"),
  supportHours: env("NEXT_PUBLIC_SUPPORT_HOURS", "Sun–Thu, 9:00–17:00"),
  defaultTitleSuffix: env("NEXT_PUBLIC_BRAND_NAME", "NÛR") + " — Modern Jewelry & Accessories",
  social: {
    instagram: env("NEXT_PUBLIC_INSTAGRAM_URL", "https://instagram.com/"),
    tiktok: env("NEXT_PUBLIC_TIKTOK_URL", "https://tiktok.com/"),
    facebook: env("NEXT_PUBLIC_FACEBOOK_URL", "https://facebook.com/"),
    whatsapp: env("NEXT_PUBLIC_WHATSAPP_NUMBER", ""),
  },
  /** Free delivery threshold in DA. 0 disables the free-delivery promise. */
  freeDeliveryThreshold: Number(env("NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD", "0")) || 0,
} as const;

export type BrandConfig = typeof BRAND_CONFIG;

export const isS3Configured = (): boolean =>
  process.env.STORAGE_DRIVER === "s3" &&
  Boolean(
    process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY &&
      process.env.STORAGE_SECRET_KEY,
  );

export const isAnalyticsConfigured = (): boolean =>
  Boolean(
    process.env.NEXT_PUBLIC_GA_ID ||
      process.env.NEXT_PUBLIC_META_PIXEL_ID ||
      process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
  );

/** Public canonical application origin; production must configure APP_URL explicitly. */
export function appUrl(): string {
  if (process.env.APP_URL) {
    const url = new URL(process.env.APP_URL);
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
      throw new Error("APP_URL must be an origin without credentials, path, query, or fragment.");
    }
    if (
      process.env.NODE_ENV === "production" &&
      (url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname))
    ) {
      throw new Error("APP_URL must be a public HTTPS origin in production.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("APP_URL must use HTTP or HTTPS.");
    }
    return url.origin;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL must be set to the canonical HTTPS origin in production.");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
