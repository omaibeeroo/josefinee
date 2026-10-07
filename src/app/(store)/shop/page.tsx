import type { Metadata } from "next";
import { getFilterFacets, getStorefrontProducts } from "@/server/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { CatalogToolbar, DesktopFilters, ProductGrid } from "@/components/storefront/catalog-ui";
import { EmptyState } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { parseCatalogParams, withPage } from "../catalog-helpers";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: t.shop.title,
    description: t.shop.description,
    alternates: { canonical: "/shop" },
  };
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseCatalogParams(params);
  const [result, facets, t] = await Promise.all([
    getStorefrontProducts(query),
    getFilterFacets(),
    getDictionary(),
  ]);

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">{t.shop.eyebrow}</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">{t.shop.title}</h1>
      </div>

      <CatalogToolbar facets={facets} total={result.total} />

      <div className="flex gap-8">
        <DesktopFilters facets={facets} />
        <div className="min-w-0 flex-1">
          {result.items.length === 0 ? (
            <EmptyState
              title={t.shop.emptyTitle}
              message={t.shop.emptyHint}
            />
          ) : (
            <>
              <ProductGrid products={result.items} />
              <Pagination page={result.page} totalPages={result.totalPages} href={(page) => `/shop${withPage(params, page)}`} prevLabel={t.pagination.previous} nextLabel={t.pagination.next} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
