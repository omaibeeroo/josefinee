import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale } from "@/lib/i18n/locales";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE);
  const name =
    locale === "ar"
      ? "Hanadi Store — مجوهرات وإكسسوارات عصرية"
      : locale === "en"
        ? "Hanadi Store — Modern jewelry and accessories"
        : "Hanadi Store — Bijoux et accessoires modernes";
  const description =
    locale === "ar"
      ? "مجوهرات وإكسسوارات خالدة تُوصَّل في جميع أنحاء الجزائر."
      : locale === "en"
        ? "Timeless jewelry and accessories delivered across Algeria."
        : "Bijoux et accessoires intemporels livrés partout en Algérie.";
  return {
    name,
    short_name: "Hanadi Store",
    description,
    start_url: "/",
    display: "standalone",
    background_color: "#fbfcfd",
    theme_color: "#f1f3f5",
    lang: locale === "ar" ? "ar" : locale === "en" ? "en" : "fr-DZ",
    dir: "ltr",
    icons: [
      {
        src: "/icon.svg",
        sizes: "64x64",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
