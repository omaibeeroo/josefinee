import type { Metadata, Viewport } from "next";
import { Almarai, Cormorant_Garamond, El_Messiri, Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/settings";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { resolveSiteMetadata } from "@/lib/i18n/metadata";
import { THEME_COOKIE, parseTheme } from "@/lib/i18n/theme";
import { localeDir } from "@/lib/i18n/locales";
import { LocaleProvider } from "@/lib/i18n/provider";
import { BRAND_CONFIG, appUrl, storagePublicOrigin } from "@/config/brand";
import { CartProvider } from "@/components/storefront/cart-ui";
import { Pixels } from "@/components/pixels";
import { CookiePreferences } from "@/components/cookie-consent";
import { NavigationProgress } from "@/components/navigation-progress";
import { headers } from "next/headers";

// Latin faces come from Google Fonts so Next self-hosts subset WOFF2 (tiny
// payloads, no TTF downloads). French/English only need the latin subset.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Premium Arabic faces, used only when the page is RTL: El Messiri
// (elegant high-contrast display) for headings, Almarai (clean, highly
// readable) for body. Subset-limited weights keep the download small.
const displayAr = El_Messiri({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-ar",
  display: "swap",
});

const sansAr = Almarai({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-sans-ar",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const [settings, locale, dictionary] = await Promise.all([
    getSettings(),
    getLocale(),
    getDictionary(),
  ]);
  const name = settings.general.name || BRAND_CONFIG.name;
  const base = appUrl();
  const ogImage = settings.seo.defaultOgImage || "/og-default.svg";
  const siteMetadata = resolveSiteMetadata(settings.seo, dictionary.siteMetadata);
  const title = `${name} — ${siteMetadata.titleSuffix}`;
  return {
    metadataBase: new URL(base),
    applicationName: name,
    title: {
      default: title,
      template: `%s · ${name}`,
    },
    description: siteMetadata.description,
    openGraph: {
      siteName: name,
      type: "website",
      locale: locale === "ar" ? "ar_DZ" : locale === "en" ? "en_US" : "fr_DZ",
      title,
      description: siteMetadata.description,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: siteMetadata.description,
      images: ogImage ? [ogImage] : undefined,
    },
    appleWebApp: {
      capable: true,
      title: name,
      statusBarStyle: "default",
    },
    formatDetection: {
      telephone: false,
    },
    icons: settings.general.faviconUrl ? { icon: settings.general.faviconUrl } : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#f1f3f5",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, requestHeaders, locale, dictionary, cookieStore] = await Promise.all([
    getSettings(),
    headers(),
    getLocale(),
    getDictionary(),
    cookies(),
  ]);
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const imageOrigin = storagePublicOrigin();
  // Keep the configured light palette available in both themes. CSS applies
  // these values only in light mode, so switching back never needs a refresh.
  const style = {
    "--light-color-gold": settings.general.colors.accent,
    "--light-color-ink": settings.general.colors.ink,
    "--light-color-ivory": settings.general.colors.background,
  } as React.CSSProperties;

  return (
    <html
      lang={locale}
      dir={localeDir(locale)}
      data-theme={theme}
      className={`${display.variable} ${sans.variable} ${displayAr.variable} ${sansAr.variable}`}
    >
      {imageOrigin && <link rel="preconnect" href={imageOrigin} />}
      <body style={style} className="min-h-screen">
        <span className="sr-only" aria-hidden="true" dir="rtl">
          <span style={{ fontFamily: "var(--font-display-ar)" }}>ـ</span>
          <span style={{ fontFamily: "var(--font-sans-ar)" }}>ـ</span>
        </span>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[80] focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory"
        >
          {dictionary.common.skipToContent}
        </a>
        <NavigationProgress />
        <LocaleProvider locale={locale} dictionary={dictionary} theme={theme}>
          <CartProvider>{children}</CartProvider>
          <CookiePreferences />
        </LocaleProvider>
        <Pixels
          gaId={settings.analytics.gaId}
          metaPixelId={settings.analytics.metaPixelId}
          tiktokPixelId={settings.analytics.tiktokPixelId}
          nonce={nonce}
        />
      </body>
    </html>
  );
}
