import { BRAND_CONFIG } from "@/config/brand";

type SeoSettings = {
  titleSuffix: string;
  defaultDescription: string;
};

type LocalizedSiteMetadata = {
  titleSuffix: string;
  description: string;
};

/** Localize untouched brand defaults, but preserve any SEO text customized in Admin. */
export function resolveSiteMetadata(
  settings: SeoSettings,
  localized: LocalizedSiteMetadata,
): LocalizedSiteMetadata {
  return {
    titleSuffix:
      settings.titleSuffix === BRAND_CONFIG.defaultTitleSuffix
        ? localized.titleSuffix
        : settings.titleSuffix,
    description:
      settings.defaultDescription === BRAND_CONFIG.description
        ? localized.description
        : settings.defaultDescription,
  };
}
