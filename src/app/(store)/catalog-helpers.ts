import type { CatalogQuery } from "@/server/catalog";
import type { ProductSort } from "@/lib/constants";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const SORTS: ProductSort[] = ["featured", "newest", "price-asc", "price-desc", "best-selling"];

export function parseCatalogParams(searchParams: SearchParams): CatalogQuery {
  const sort = first(searchParams.sort);
  const min = first(searchParams.min);
  const max = first(searchParams.max);
  return {
    inStock: first(searchParams.inStock) === "1" ? true : undefined,
    onSale: first(searchParams.onSale) === "1" ? true : undefined,
    minPrice: min && /^\d+$/.test(min) ? Number(min) : undefined,
    maxPrice: max && /^\d+$/.test(max) ? Number(max) : undefined,
    colors: first(searchParams.colors)?.split(",").filter(Boolean),
    sizes: first(searchParams.sizes)?.split(",").filter(Boolean),
    sort: sort && (SORTS as string[]).includes(sort) ? (sort as ProductSort) : undefined,
    page: first(searchParams.page) ? Math.max(1, Number.parseInt(first(searchParams.page) as string, 10) || 1) : 1,
  };
}

export function withPage(params: SearchParams, page: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    next.set(key, Array.isArray(value) ? value[0] ?? "" : value);
  }
  next.set("page", String(page));
  const query = next.toString();
  return query ? `?${query}` : "?page=1";
}
