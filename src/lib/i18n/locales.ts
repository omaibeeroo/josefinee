export const LOCALES = ["fr", "en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_COOKIE = "hanadi-locale";

export function parseLocale(value: unknown): Locale {
  return value === "en" || value === "ar" ? value : "fr";
}

/** Arabic is right-to-left; French and English are left-to-right. */
export function localeDir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
