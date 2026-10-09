"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/i18n/provider";
import { ProductCard } from "@/components/storefront/product";
import type { StoreProductCard } from "@/server/catalog";

export function ProductGrid({ products }: { products: StoreProductCard[] }) {
  return (
    <div className="motion-stagger grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-2">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

const SORT_VALUES = ["featured", "newest", "price-asc", "price-desc", "best-selling"] as const;

export function CatalogToolbar({
  total,
  title,
}: {
  total: number;
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  function setSort(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort) params.set("sort", sort);
    else params.delete("sort");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const sortLabels: Record<(typeof SORT_VALUES)[number], string> = {
    featured: t.sort.featured,
    newest: t.sort.newest,
    "price-asc": t.sort.priceAsc,
    "price-desc": t.sort.priceDesc,
    "best-selling": t.sort.bestSelling,
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-soft" aria-live="polite">
        {title ? `${title} · ` : ""}
        {total} {total === 1 ? t.catalog.item : t.catalog.items}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <span className="hidden sm:inline">{t.catalog.sort}</span>
        <select
          value={searchParams.get("sort") ?? "featured"}
          onChange={(event) => setSort(event.target.value)}
          className="field min-h-10 w-auto"
          aria-label={t.catalog.sortProducts}
        >
          {SORT_VALUES.map((value) => (
            <option key={value} value={value}>
              {sortLabels[value]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
