import type { Metadata } from "next";
import { getFilterFacets, getStorefrontProducts } from "@/server/catalog";
import { CatalogToolbar, DesktopFilters, ProductGrid } from "@/components/storefront/catalog-ui";
import { EmptyState } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { parseCatalogParams, withPage } from "../catalog-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Browse the full collection — jewelry, bags and accessories delivered across Algeria.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseCatalogParams(params);
  const [result, facets] = await Promise.all([
    getStorefrontProducts(query),
    getFilterFacets(),
  ]);

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">The edit</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Shop all</h1>
      </div>

      <CatalogToolbar facets={facets} total={result.total} />

      <div className="flex gap-8">
        <DesktopFilters facets={facets} />
        <div className="min-w-0 flex-1">
          {result.items.length === 0 ? (
            <EmptyState
              title="No products found"
              message="Try removing some filters to see more pieces."
            />
          ) : (
            <>
              <ProductGrid products={result.items} />
              <Pagination page={result.page} totalPages={result.totalPages} href={(page) => `/shop${withPage(params, page)}`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
