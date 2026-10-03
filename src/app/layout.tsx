import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { BRAND_CONFIG, appUrl } from "@/config/brand";
import { CartProvider } from "@/components/storefront/cart-ui";
import { Pixels } from "@/components/pixels";
import { CookiePreferences } from "@/components/cookie-consent";
import { NavigationProgress } from "@/components/navigation-progress";
import { headers } from "next/headers";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
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
    icons: settings.general.faviconUrl ? { icon: settings.general.faviconUrl } : undefined,
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf8f4",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, requestHeaders] = await Promise.all([getSettings(), headers()]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const style = {
    "--color-gold": settings.general.colors.accent,
    "--color-ink": settings.general.colors.ink,
    "--color-ivory": settings.general.colors.background,
  } as React.CSSProperties;

  return (
    <html lang="fr" className={`${display.variable} ${sans.variable}`}>
      <body style={style} className="min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory"
        >
          Aller au contenu
        </a>
        <NavigationProgress />
        <CartProvider>{children}</CartProvider>
        <CookiePreferences />
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
