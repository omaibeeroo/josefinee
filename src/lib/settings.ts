import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { BRAND_CONFIG } from "@/config/brand";

export type GeneralSettings = {
  name: string;
  legalName: string;
  tagline: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string;
  faviconUrl: string;
  colors: { accent: string; ink: string; background: string };
};

export type HomepageSettings = {
  announcement: { text: string; href: string; isActive: boolean };
  hero: {
    eyebrow: string;
    headline: string;
    subheading: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
    imageDesktop: string;
    imageMobile: string;
  };
  featuredCollectionSlug: string;
  showSocialProof: boolean;
  /** 0 = derive from real delivered orders; set a value to show a verified figure. */
  socialProofOverride: number;
  pillars: Array<{ title: string; text: string }>;
};

export type CommerceSettings = {
  currency: string;
  currencySymbol: string;
  codEnabled: boolean;
  freeDeliveryThreshold: number;
  lowStockThresholdDefault: number;
  orderPrefix: string;
  defaultDeliveryMethod: "HOME" | "STOPDESK" | "EXPRESS" | "STANDARD";
};

export type SeoSettings = {
  titleSuffix: string;
  defaultDescription: string;
  defaultOgImage: string;
};

export type SocialSettings = {
  instagram: string;
  tiktok: string;
  facebook: string;
  whatsapp: string;
};

export type AnalyticsSettings = {
  gaId: string;
  metaPixelId: string;
  tiktokPixelId: string;
};

export type NotificationSettings = {
  orderEmailEnabled: boolean;
  orderSmsEnabled: boolean;
  orderWhatsappEnabled: boolean;
};

export type SettingsMap = {
  general: GeneralSettings;
  homepage: HomepageSettings;
  commerce: CommerceSettings;
  seo: SeoSettings;
  social: SocialSettings;
  analytics: AnalyticsSettings;
  notifications: NotificationSettings;
};

export const DEFAULT_SETTINGS: SettingsMap = {
  general: {
    name: BRAND_CONFIG.name,
    legalName: BRAND_CONFIG.legalName,
    tagline: BRAND_CONFIG.tagline,
    description: BRAND_CONFIG.description,
    email: BRAND_CONFIG.supportEmail,
    phone: BRAND_CONFIG.supportPhone,
    address: "",
    logoUrl: "",
    faviconUrl: "",
    colors: { accent: "#b08d57", ink: "#1c1a17", background: "#faf8f4" },
  },
  homepage: {
    announcement: {
      text: "Express delivery across Algeria — Cash on delivery available",
      href: "/collections/new-in",
      isActive: true,
    },
    hero: {
      eyebrow: "New collection",
      headline: "THE PIECES YOU'LL WEAR ON REPEAT",
      subheading:
        "Timeless jewelry and accessories, carefully finished and delivered to your door anywhere in Algeria.",
      primaryLabel: "Shop now",
      primaryHref: "/shop",
      secondaryLabel: "Discover collection",
      secondaryHref: "/collections/new-in",
      imageDesktop: "",
      imageMobile: "",
    },
    featuredCollectionSlug: "jewelry",
    showSocialProof: true,
    socialProofOverride: 0,
    pillars: [
      {
        title: "Prepared with care",
        text: "Every order is checked and wrapped by hand before it leaves our studio.",
      },
      {
        title: "Delivered to you",
        text: "Fast delivery to all 58 wilayas, with cash on delivery for peace of mind.",
      },
      {
        title: "Customer support",
        text: "Our team is available to answer your questions before and after your order.",
      },
    ],
  },
  commerce: {
    currency: BRAND_CONFIG.currency,
    currencySymbol: BRAND_CONFIG.currencySymbol,
    codEnabled: true,
    freeDeliveryThreshold: BRAND_CONFIG.freeDeliveryThreshold,
    lowStockThresholdDefault: 3,
    orderPrefix: BRAND_CONFIG.orderPrefix,
    defaultDeliveryMethod: "HOME",
  },
  seo: {
    titleSuffix: BRAND_CONFIG.defaultTitleSuffix,
    defaultDescription: BRAND_CONFIG.description,
    defaultOgImage: "",
  },
  social: {
    instagram: BRAND_CONFIG.social.instagram,
    tiktok: BRAND_CONFIG.social.tiktok,
    facebook: BRAND_CONFIG.social.facebook,
    whatsapp: BRAND_CONFIG.social.whatsapp,
  },
  analytics: { gaId: "", metaPixelId: "", tiktokPixelId: "" },
  notifications: { orderEmailEnabled: true, orderSmsEnabled: false, orderWhatsappEnabled: false },
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof SettingsMap>;

function mergeSection<K extends keyof SettingsMap>(key: K, value: unknown): SettingsMap[K] {
  const defaults = DEFAULT_SETTINGS[key] as SettingsMap[K];
  if (!value || typeof value !== "object") return defaults;
  const stored = value as Record<string, unknown>;
  const merged = { ...(defaults as Record<string, unknown>), ...stored } as SettingsMap[K];

  if (key === "general") {
    const general = merged as unknown as GeneralSettings;
    general.colors = {
      ...DEFAULT_SETTINGS.general.colors,
      ...((stored.colors as Partial<GeneralSettings["colors"]> | undefined) ?? {}),
    };
  }
  if (key === "homepage") {
    const home = merged as unknown as HomepageSettings;
    home.hero = { ...DEFAULT_SETTINGS.homepage.hero, ...((stored.hero as object | undefined) ?? {}) };
    home.announcement = {
      ...DEFAULT_SETTINGS.homepage.announcement,
      ...((stored.announcement as object | undefined) ?? {}),
    };
    if (Array.isArray(stored.pillars) && stored.pillars.length > 0) {
      home.pillars = stored.pillars as HomepageSettings["pillars"];
    }
  }
  return merged;
}

export const getSettings = cache(async (): Promise<SettingsMap> => {
  const result: SettingsMap = structuredClone(DEFAULT_SETTINGS);
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const mutable = result as unknown as Record<string, SettingsMap[keyof SettingsMap]>;
    for (const key of SETTING_KEYS) {
      const stored = byKey.get(key);
      if (stored !== undefined) {
        mutable[key] = mergeSection(key, stored);
      }
    }
  } catch {
    // Database unavailable — fall back to defaults so the storefront still renders.
  }
  return result;
});

export async function updateSettingsSection<K extends keyof SettingsMap>(
  key: K,
  value: Partial<SettingsMap[K]>,
): Promise<SettingsMap[K]> {
  const current = (await getSettings())[key];
  const merged = mergeSection(key, { ...(current as object), ...(value as object) });
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: merged as object },
    update: { value: merged as object },
  });
  return merged;
}
