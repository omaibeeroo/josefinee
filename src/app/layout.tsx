import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/settings";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { THEME_COOKIE, parseTheme } from "@/lib/i18n/theme";
import { LocaleProvider } from "@/lib/i18n/provider";
import { BRAND_CONFIG, appUrl } from "@/config/brand";
import { CartProvider } from "@/components/storefront/cart-ui";
import { Pixels } from "@/components/pixels";
import { CookiePreferences } from "@/components/cookie-consent";
import { NavigationProgress } from "@/components/navigation-progress";
import { headers } from "next/headers";

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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const name = settings.general.name || BRAND_CONFIG.name;
  const base = appUrl();
  const ogImage = settings.seo.defaultOgImage || "/og-default.svg";
  return {
    metadataBase: new URL(base),
    applicationName: name,
    title: {
      default: `${name} — ${settings.seo.titleSuffix}`,
      template: `%s · ${name}`,
    },
    description: settings.seo.defaultDescription,
    openGraph: {
      siteName: name,
      type: "website",
      locale: "fr_DZ",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — ${settings.seo.titleSuffix}`,
      description: settings.seo.defaultDescription,
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
  // Admin brand colors apply in light mode only; dark mode uses its own
  // fixed palette so text stays readable on dark surfaces.
  const style = (
    theme === "dark"
      ? undefined
      : {
          "--color-gold": settings.general.colors.accent,
          "--color-ink": settings.general.colors.ink,
          "--color-ivory": settings.general.colors.background,
        }
  ) as React.CSSProperties | undefined;

  return (
    <html lang={locale} data-theme={theme} className={`${display.variable} ${sans.variable}`}>
      <body style={style} className="min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory"
        >
          {locale === "en" ? "Skip to content" : "Aller au contenu"}
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
