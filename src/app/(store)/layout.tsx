import { getSettings, isAnnouncementVisible } from "@/lib/settings";
import { getNavigation, getPopularSearches } from "@/server/navigation";
import { SiteChrome } from "@/components/storefront/chrome";
import { prisma } from "@/lib/prisma";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, navigation, popularSearches, faqItems] = await Promise.all([
    getSettings(),
    getNavigation(),
    getPopularSearches(),
    prisma.faqItem.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }],
      select: { question: true, answer: true },
      take: 5,
    }),
  ]);

  const announcement = isAnnouncementVisible(settings.homepage.announcement)
    ? {
        text: settings.homepage.announcement.text,
        href: settings.homepage.announcement.href || "/shop",
      }
    : null;

  return (
    <SiteChrome
      brandName={settings.general.name}
      logoUrl={settings.general.logoUrl}
      announcement={announcement}
      categories={navigation.categories}
      collections={navigation.collections}
      social={settings.social}
      supportEmail={settings.general.email}
      supportPhone={settings.general.phone}
      popularSearches={popularSearches}
      faqItems={faqItems}
    >
      <div id="main-content">{children}</div>
    </SiteChrome>
  );
}
