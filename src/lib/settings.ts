import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { BRAND_CONFIG } from "@/config/brand";
import { z } from "zod";

type GeneralSettings = {
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

export const HOMEPAGE_SECTION_IDS = [
  "featured",
  "spotlight",
  "featuredCollection",
  "bestSellers",
  "newIn",
  "categories",
  "trust",
  "socialProof",
  "faq",
] as const;

export type HomepageSectionId = (typeof HOMEPAGE_SECTION_IDS)[number];

export type HomepageSettings = {
  announcement: {
    text: string;
    href: string;
    isActive: boolean;
    /** ISO datetimes bounding the bar; null = unbounded on that side. */
    startsAt: string | null;
    endsAt: string | null;
  };
  /** Display density knobs, edited in Admin → Vitrine (no copy, locale-safe). */
  display: {
    featuredCount: number;
    bestSellersCount: number;
    newInCount: number;
    categoryCount: number;
  };
  /** Ordered homepage blocks; hidden ones are skipped when rendering. */
  sections: Array<{ id: HomepageSectionId; visible: boolean }>;
  /** Hand-picked spotlight product; null = first featured product. */
  spotlightProductId: string | null;
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

type CommerceSettings = {
  currency: string;
  currencySymbol: string;
  codEnabled: boolean;
  freeDeliveryThreshold: number;
  lowStockThresholdDefault: number;
  orderPrefix: string;
  defaultDeliveryMethod: "HOME" | "STOPDESK" | "EXPRESS" | "STANDARD";
  /** Products per listing page (shop/search/categories/collections). */
  catalogPageSize: number;
};

type SeoSettings = {
  titleSuffix: string;
  defaultDescription: string;
  defaultOgImage: string;
};

type SocialSettings = {
  instagram: string;
  tiktok: string;
  facebook: string;
  whatsapp: string;
};

type AnalyticsSettings = {
  gaId: string;
  metaPixelId: string;
  tiktokPixelId: string;
};

type NotificationSettings = {
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
      text: "Livraison partout en Algérie · Paiement à la livraison",
      href: "/collections/new-in",
      isActive: true,
      startsAt: null,
      endsAt: null,
    },
    display: {
      featuredCount: 10,
      bestSellersCount: 10,
      newInCount: 10,
      categoryCount: 6,
    },
    hero: {
      eyebrow: "Nouvelle collection",
      headline: "DES PIÈCES À PORTER ENCORE ET ENCORE",
      subheading:
        "Des bijoux et accessoires intemporels, préparés avec soin et livrés chez vous partout en Algérie.",
      primaryLabel: "Découvrir la boutique",
      primaryHref: "/shop",
      secondaryLabel: "Voir la collection",
      secondaryHref: "/collections/new-in",
      imageDesktop: "",
      imageMobile: "",
    },
    featuredCollectionSlug: "jewelry",
    sections: [
      { id: "featured", visible: true },
      { id: "spotlight", visible: true },
      { id: "featuredCollection", visible: true },
      { id: "bestSellers", visible: true },
      { id: "newIn", visible: true },
      { id: "categories", visible: true },
      { id: "trust", visible: true },
      { id: "socialProof", visible: true },
      { id: "faq", visible: true },
    ],
    spotlightProductId: null,
    showSocialProof: true,
    socialProofOverride: 0,
    pillars: [
      {
        title: "Préparé avec soin",
        text: "Chaque commande est vérifiée et emballée avec attention avant son expédition.",
      },
      {
        title: "Livré chez vous",
        text: "Livraison dans les 58 wilayas, avec paiement à la livraison en toute simplicité.",
      },
      {
        title: "À votre écoute",
        text: "Notre équipe répond à vos questions avant et après votre commande.",
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
    catalogPageSize: 12,
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

const safeLink = z
  .string()
  .max(1000)
  .refine(
    (value) =>
      value === "" ||
      (value.startsWith("/") &&
        !value.startsWith("//") &&
        !value.includes("\\") &&
        !/[\u0000-\u001f\u007f]/.test(value)) ||
      /^https:\/\/[^\s]+$/i.test(value),
    "Links must be relative paths or HTTPS URLs.",
  );

const settingsSchemas = {
  general: z.object({
    name: z.string().max(120),
    legalName: z.string().max(200),
    tagline: z.string().max(240),
    description: z.string().max(2000),
    email: z.string().max(320),
    phone: z.string().max(40),
    address: z.string().max(500),
    logoUrl: safeLink,
    faviconUrl: safeLink,
    colors: z.object({
      accent: z.string().regex(/^#[0-9a-f]{6}$/i),
      ink: z.string().regex(/^#[0-9a-f]{6}$/i),
      background: z.string().regex(/^#[0-9a-f]{6}$/i),
    }),
  }),
  homepage: z.object({
    announcement: z.object({
      text: z.string().max(240),
      href: safeLink,
      isActive: z.boolean(),
      startsAt: z.string().max(30).nullable(),
      endsAt: z.string().max(30).nullable(),
    }),
    display: z.object({
      featuredCount: z.number().int().min(2).max(24),
      bestSellersCount: z.number().int().min(2).max(24),
      newInCount: z.number().int().min(2).max(24),
      categoryCount: z.number().int().min(2).max(12),
    }),
    hero: z.object({
      eyebrow: z.string().max(120),
      headline: z.string().max(240),
      subheading: z.string().max(1000),
      primaryLabel: z.string().max(120),
      primaryHref: safeLink,
      secondaryLabel: z.string().max(120),
      secondaryHref: safeLink,
      imageDesktop: safeLink,
      imageMobile: safeLink,
    }),
    featuredCollectionSlug: z.string().max(160),
    sections: z
      .array(
        z.object({
          id: z.enum(HOMEPAGE_SECTION_IDS),
          visible: z.boolean(),
        }),
      )
      .max(24),
    spotlightProductId: z.string().max(64).nullable(),
    showSocialProof: z.boolean(),
    socialProofOverride: z.number().int().nonnegative(),
    pillars: z.array(z.object({ title: z.string().max(120), text: z.string().max(500) })).max(12),
  }),
  commerce: z.object({
    currency: z.string().max(10),
    currencySymbol: z.string().max(10),
    codEnabled: z.boolean(),
    freeDeliveryThreshold: z.number().int().nonnegative(),
    lowStockThresholdDefault: z.number().int().nonnegative(),
    orderPrefix: z.string().regex(/^[A-Z0-9-]{1,20}$/),
    defaultDeliveryMethod: z.enum(["HOME", "STOPDESK", "EXPRESS", "STANDARD"]),
    catalogPageSize: z.number().int().min(6).max(48),
  }),
  seo: z.object({
    titleSuffix: z.string().max(160),
    defaultDescription: z.string().max(2000),
    defaultOgImage: safeLink,
  }),
  social: z.object({
    instagram: safeLink,
    tiktok: safeLink,
    facebook: safeLink,
    whatsapp: safeLink,
  }),
  analytics: z.object({
    gaId: z.string().max(100),
    metaPixelId: z.string().max(100),
    tiktokPixelId: z.string().max(100),
  }),
  notifications: z.object({
    orderEmailEnabled: z.boolean(),
    orderSmsEnabled: z.boolean(),
    orderWhatsappEnabled: z.boolean(),
  }),
} satisfies { [K in keyof SettingsMap]: z.ZodType<SettingsMap[K]> };

export function mergeSection<K extends keyof SettingsMap>(key: K, value: unknown): SettingsMap[K] {
  const defaults = DEFAULT_SETTINGS[key] as SettingsMap[K];
  if (!value || typeof value !== "object") return defaults;
  const stored = value as Record<string, unknown>;
  const merged = { ...(defaults as Record<string, unknown>), ...stored } as SettingsMap[K];

  if (key === "general") {
    const general = merged as unknown as GeneralSettings;
    if (general.email.toLowerCase().endsWith("@example.com")) general.email = "";
    if (general.phone.replace(/\D/g, "") === "0550000000") general.phone = "";
    general.colors = {
      ...DEFAULT_SETTINGS.general.colors,
      ...((stored.colors as Partial<GeneralSettings["colors"]> | undefined) ?? {}),
    };
  }
  if (key === "homepage") {
    const home = merged as unknown as HomepageSettings;
    home.hero = {
      ...DEFAULT_SETTINGS.homepage.hero,
      ...((stored.hero as object | undefined) ?? {}),
    };
    home.announcement = {
      ...DEFAULT_SETTINGS.homepage.announcement,
      ...((stored.announcement as object | undefined) ?? {}),
    };
    if (Array.isArray(stored.pillars) && stored.pillars.length > 0) {
      home.pillars = stored.pillars as HomepageSettings["pillars"];
    }
    // Sanitize the vitrine section order: keep known ids in saved order,
    // then append any missing default block as visible (forward-compatible).
    {
      const seen = new Set<string>();
      const ordered: HomepageSettings["sections"] = [];
      const storedSections = Array.isArray(stored.sections) ? stored.sections : [];
      for (const entry of storedSections) {
        if (
          entry &&
          typeof entry === "object" &&
          typeof (entry as { id?: unknown }).id === "string" &&
          (HOMEPAGE_SECTION_IDS as readonly string[]).includes((entry as { id: string }).id) &&
          !seen.has((entry as { id: string }).id)
        ) {
          seen.add((entry as { id: string }).id);
          ordered.push({
            id: (entry as { id: HomepageSectionId }).id,
            visible: (entry as { visible?: unknown }).visible !== false,
          });
        }
      }
      for (const def of DEFAULT_SETTINGS.homepage.sections) {
        if (!seen.has(def.id)) ordered.push({ ...def });
      }
      home.sections = ordered;
    }
    if (typeof home.spotlightProductId !== "string" || home.spotlightProductId.length === 0) {
      home.spotlightProductId = null;
    }
    // Display density knobs: coerce to safe integers within bounds so a bad
    // stored value can never break listing queries.
    {
      const def = DEFAULT_SETTINGS.homepage.display;
      const storedDisplay = (stored.display ?? {}) as Partial<HomepageSettings["display"]>;
      const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
        const n = typeof value === "number" ? Math.floor(value) : Number.NaN;
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
      };
      home.display = {
        featuredCount: clampInt(storedDisplay.featuredCount, 2, 24, def.featuredCount),
        bestSellersCount: clampInt(storedDisplay.bestSellersCount, 2, 24, def.bestSellersCount),
        newInCount: clampInt(storedDisplay.newInCount, 2, 24, def.newInCount),
        categoryCount: clampInt(storedDisplay.categoryCount, 2, 12, def.categoryCount),
      };
    }
    // Announcement schedule: keep only parseable datetimes; an inverted
    // window disables the schedule rather than hiding the bar forever.
    {
      const cleanDate = (value: unknown): string | null => {
        if (typeof value !== "string" || value.trim() === "") return null;
        const time = Date.parse(value);
        return Number.isFinite(time) ? new Date(time).toISOString() : null;
      };
      const announcement = home.announcement as unknown as {
        startsAt?: unknown;
        endsAt?: unknown;
      };
      const startsAt = cleanDate(announcement.startsAt);
      let endsAt = cleanDate(announcement.endsAt);
      if (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt)) endsAt = null;
      announcement.startsAt = startsAt;
      announcement.endsAt = endsAt;
    }
  }
  if (key === "commerce") {
    const commerce = merged as unknown as CommerceSettings;
    const fallback = DEFAULT_SETTINGS.commerce.catalogPageSize;
    const n =
      typeof commerce.catalogPageSize === "number"
        ? Math.floor(commerce.catalogPageSize)
        : Number.NaN;
    commerce.catalogPageSize = Number.isFinite(n)
      ? Math.min(48, Math.max(6, n))
      : fallback;
  }
  if (key === "social") {
    const social = merged as unknown as SocialSettings;
    for (const field of ["instagram", "tiktok", "facebook"] as const) {
      if (/^https:\/\/[^/]+\/?$/.test(social[field])) social[field] = "";
    }
  }
  const parsed = settingsSchemas[key].safeParse(merged);
  if (!parsed.success) {
    // Corrupt stored settings must be visible, not silently papered over:
    // the storefront falls back to defaults while admins investigate.
    console.error(
      `[settings] stored "${key}" failed validation, using defaults`,
      parsed.error.issues.map((issue) => issue.path.join(".")).join(","),
    );
    return defaults as SettingsMap[K];
  }
  return parsed.data as SettingsMap[K];
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

/**
 * Announcement bar visibility: the toggle plus an optional scheduling
 * window (either bound may be null for open-ended).
 */
export function isAnnouncementVisible(
  announcement: HomepageSettings["announcement"],
  now = new Date(),
): boolean {
  if (!announcement.isActive) return false;
  const time = now.getTime();
  if (announcement.startsAt && Date.parse(announcement.startsAt) > time) return false;
  if (announcement.endsAt && Date.parse(announcement.endsAt) < time) return false;
  return true;
}

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
