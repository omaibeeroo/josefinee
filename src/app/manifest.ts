import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import { BRAND_CONFIG } from "@/config/brand";
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale } from "@/lib/i18n/locales";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);
  const name =
    locale === "ar"
      ? `${BRAND_CONFIG.name} — مجوهرات وإكسسوارات عصرية`
      : locale === "en"
        ? `${BRAND_CONFIG.name} — Modern jewelry and accessories`
        : `${BRAND_CONFIG.name} — Bijoux et accessoires modernes`;
  const description =
    locale === "ar"
      ? "مجوهرات وإكسسوارات خالدة تُوصَّل في جميع أنحاء الجزائر."
      : locale === "en"
        ? "Timeless jewelry and accessories delivered across Algeria."
        : "Bijoux et accessoires intemporels livrés partout en Algérie.";
  return {
    name,
    short_name: BRAND_CONFIG.name,
    description,
    start_url: "/",
    display: "standalone",
    background_color: "#fbfcfd",
    theme_color: "#f1f3f5",
    lang: locale === "ar" ? "ar" : locale === "en" ? "en" : "fr-DZ",
    dir: locale === "ar" ? "rtl" : "ltr",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
