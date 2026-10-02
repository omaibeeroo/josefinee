import type { Metadata } from "next";
import Link from "next/link";
import { getFilterFacets, getStorefrontProducts } from "@/server/catalog";
import { recordSearch } from "@/server/navigation";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";
import { PixelEvent } from "@/components/pixels";
import { CatalogToolbar, DesktopFilters, ProductGrid } from "@/components/storefront/catalog-ui";
import { EmptyState } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { parseCatalogParams, withPage } from "../catalog-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description: "Search jewelry, bags and accessories.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const term = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  if (term) {
    await recordSearch(term);
    await trackEvent({ name: ANALYTICS_EVENTS.SEARCH, props: { term: term.slice(0, 80) } });
  }

  const query = parseCatalogParams(params);
  const [result, facets] = term
    ? await Promise.all([getStorefrontProducts({ ...query, search: term }), getFilterFacets()])
    : [{ items: [], total: 0, page: 1, pageSize: 12, totalPages: 1 }, { colors: [], sizes: [], minPrice: 0, maxPrice: 0 }];

  return (
    <div className="container-luxe py-10 md:py-14">
      {term && <PixelEvent name="Search" params={{ search_string: term }} />}
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">Search</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">
          {term ? `Results for “${term}”` : "Search the store"}
        </h1>
      </div>

      {!term ? (
        <EmptyState
          title="What are you looking for?"
          message="Try “necklace”, “tote” or “gold hoops”."
          action={
            <Link href="/shop" className="btn btn-outline">
              Browse everything
            </Link>
          }
        />
      ) : (
        <>
          <CatalogToolbar facets={facets} total={result.total} />
          <div className="flex gap-8">
            <DesktopFilters facets={facets} />
            <div className="min-w-0 flex-1">
              {result.items.length === 0 ? (
                <EmptyState
                  title="No matches"
                  message="Try a different word, or browse the full collection."
                  action={
                    <Link href="/shop" className="btn btn-outline">
                      Shop all
                    </Link>
                  }
                />
              ) : (
                <>
                  <ProductGrid products={result.items} />
                  <Pagination
                    page={result.page}
                    totalPages={result.totalPages}
                    href={(page) => `/search${withPage({ ...params, q: term }, page)}`}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
