import type { CatalogQuery } from "@/server/catalog";
import type { ProductSort } from "@/lib/constants";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const SORTS: ProductSort[] = ["featured", "newest", "price-asc", "price-desc", "best-selling"];

function stringList(value: string | string[] | undefined, maxItems = 12, maxLength = 40): string[] | undefined {
  const raw = first(value);
  if (!raw) return undefined;
  const items = raw
    .split(",")
    .map((entry) => entry.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
  return items.length > 0 ? items : undefined;
}

export function parseCatalogParams(searchParams: SearchParams): CatalogQuery {
  const sort = first(searchParams.sort);
  const min = first(searchParams.min);
  const max = first(searchParams.max);
  const rawPage = first(searchParams.page);
  return {
    inStock: first(searchParams.inStock) === "1" ? true : undefined,
    onSale: first(searchParams.onSale) === "1" ? true : undefined,
    minPrice: min && /^\d+$/.test(min) ? Math.min(Number(min), 100_000_000) : undefined,
    maxPrice: max && /^\d+$/.test(max) ? Math.min(Number(max), 100_000_000) : undefined,
    colors: stringList(searchParams.colors),
    sizes: stringList(searchParams.sizes),
    sort: sort && (SORTS as string[]).includes(sort) ? (sort as ProductSort) : undefined,
    page: rawPage ? Math.min(500, Math.max(1, Number.parseInt(rawPage, 10) || 1)) : 1,
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
