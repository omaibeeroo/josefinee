import { getSettings } from "@/lib/settings";
import { getNavigation, getPopularSearches } from "@/server/navigation";
import { SiteChrome } from "@/components/storefront/chrome";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, navigation, popularSearches] = await Promise.all([
    getSettings(),
    getNavigation(),
    getPopularSearches(),
  ]);

  const announcement = settings.homepage.announcement.isActive
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
    >
      <div id="main-content">{children}</div>
    </SiteChrome>
  );
}
