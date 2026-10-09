import type { Metadata } from "next";
import { after } from "next/server";
import Link from "next/link";
import { getStorefrontProducts } from "@/server/catalog";
import { recordSearch } from "@/server/navigation";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";
import { PixelEvent } from "@/components/pixels";
import { CatalogToolbar, ProductGrid } from "@/components/storefront/catalog-ui";
import { EmptyState } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { parseCatalogParams, withPage } from "../catalog-helpers";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: t.search.title,
    description: t.search.description,
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const term = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 80) ?? "";

  if (term) {
    after(async () => {
      await Promise.allSettled([
        recordSearch(term),
        trackEvent({ name: ANALYTICS_EVENTS.SEARCH, props: { term: term.slice(0, 80) } }),
      ]);
    });
  }

  const query = parseCatalogParams(params);
  const [result, t] = term
    ? await Promise.all([getStorefrontProducts({ ...query, search: term }), getDictionary()])
    : [{ items: [], total: 0, page: 1, pageSize: 12, totalPages: 1 }, await getDictionary()];

  return (
    <div className="container-luxe py-10 md:py-14">
      {term && <PixelEvent name="Search" params={{ search_string: term }} />}
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">{t.search.title}</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">
          {term ? t.search.resultsFor.replace("{term}", term) : t.search.searchStore}
        </h1>
      </div>

      {!term ? (
        <EmptyState
          title={t.search.nothingLooking}
          message={t.search.tryExamples}
          action={
            <Link href="/shop" className="btn btn-outline">
              {t.common.browseAll}
            </Link>
          }
        />
      ) : (
        <>
          <CatalogToolbar total={result.total} />
          <div className="flex gap-8">
            <div className="min-w-0 flex-1">
              {result.items.length === 0 ? (
                <EmptyState
                  title={t.search.noMatches}
                  message={t.search.noMatchesHint}
                  action={
                    <Link href="/shop" className="btn btn-outline">
                      {t.footer.shopAll}
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
                    prevLabel={t.pagination.previous}
                    nextLabel={t.pagination.next}
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
