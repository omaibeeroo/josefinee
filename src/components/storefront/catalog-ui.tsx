"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { ProductCard } from "@/components/storefront/product";
import { PRODUCT_SORT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { StoreProductCard } from "@/server/catalog";

export function ProductGrid({ products }: { products: StoreProductCard[] }) {
  return (
    <div className="motion-stagger grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export type Facets = { colors: string[]; sizes: string[]; minPrice: number; maxPrice: number };

export type FilterState = {
  inStock?: boolean;
  onSale?: boolean;
  minPrice?: number;
  maxPrice?: number;
  colors: string[];
  sizes: string[];
  sort?: string;
};

function parseFilters(params: URLSearchParams): FilterState {
  return {
    inStock: params.get("inStock") === "1" ? true : undefined,
    onSale: params.get("onSale") === "1" ? true : undefined,
    minPrice: params.get("min") ? Number(params.get("min")) : undefined,
    maxPrice: params.get("max") ? Number(params.get("max")) : undefined,
    colors: params.get("colors")?.split(",").filter(Boolean) ?? [],
    sizes: params.get("sizes")?.split(",").filter(Boolean) ?? [],
    sort: params.get("sort") ?? undefined,
  };
}

function toQueryParams(state: FilterState, current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of current.entries()) {
    if (!["inStock", "onSale", "min", "max", "colors", "sizes", "sort", "page"].includes(key)) {
      next.set(key, value);
    }
  }
  if (state.inStock) next.set("inStock", "1");
  if (state.onSale) next.set("onSale", "1");
  if (state.minPrice !== undefined) next.set("min", String(state.minPrice));
  if (state.maxPrice !== undefined) next.set("max", String(state.maxPrice));
  if (state.colors.length > 0) next.set("colors", state.colors.join(","));
  if (state.sizes.length > 0) next.set("sizes", state.sizes.join(","));
  if (state.sort) next.set("sort", state.sort);
  return next;
}

function FiltersForm({
  facets,
  initial,
  onApply,
}: {
  facets: Facets;
  initial: FilterState;
  onApply: (state: FilterState) => void;
}) {
  const [state, setState] = useState<FilterState>(initial);
  const [minInput, setMinInput] = useState(initial.minPrice !== undefined ? String(initial.minPrice) : "");
  const [maxInput, setMaxInput] = useState(initial.maxPrice !== undefined ? String(initial.maxPrice) : "");

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
  }

  function apply() {
    onApply({
      ...state,
      minPrice: minInput ? Number(minInput) : undefined,
      maxPrice: maxInput ? Number(maxInput) : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">Disponibilité</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(state.inStock)}
            onChange={(event) => setState({ ...state, inStock: event.target.checked || undefined })}
            className="h-4 w-4 accent-[#1c1a17]"
          />
          En stock uniquement
        </label>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(state.onSale)}
            onChange={(event) => setState({ ...state, onSale: event.target.checked || undefined })}
            className="h-4 w-4 accent-[#1c1a17]"
          />
          En promotion
        </label>
      </div>

      {facets.maxPrice > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">Prix (DA)</p>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={minInput}
              onChange={(event) => setMinInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder={String(facets.minPrice)}
              aria-label="Prix minimum"
              className="field min-h-10"
            />
            <span className="text-ink-muted">–</span>
            <input
              inputMode="numeric"
              value={maxInput}
              onChange={(event) => setMaxInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder={String(facets.maxPrice)}
              aria-label="Prix maximum"
              className="field min-h-10"
            />
          </div>
        </div>
      )}

      {facets.colors.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">Couleur</p>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((color) => (
              <button
                key={color}
                type="button"
                aria-pressed={state.colors.includes(color)}
                onClick={() => setState({ ...state, colors: toggle(state.colors, color) })}
                className={cn(
                  "border px-3 py-1.5 text-sm",
                  state.colors.includes(color) ? "border-ink bg-ink text-ivory" : "hairline bg-white",
                )}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {facets.sizes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">Taille</p>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={state.sizes.includes(size)}
                onClick={() => setState({ ...state, sizes: toggle(state.sizes, size) })}
                className={cn(
                  "border px-3 py-1.5 text-sm",
                  state.sizes.includes(size) ? "border-ink bg-ink text-ivory" : "hairline bg-white",
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={apply}
          className="flex-1"
        >
          Appliquer les filtres
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const cleared: FilterState = { colors: [], sizes: [] };
            setState(cleared);
            setMinInput("");
            setMaxInput("");
            onApply(cleared);
          }}
        >
          Effacer
        </Button>
      </div>
    </div>
  );
}

export function CatalogToolbar({
  facets,
  total,
  title,
}: {
  facets: Facets;
  total: number;
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const initial = useMemo(() => parseFilters(searchParams), [searchParams]);

  function apply(state: FilterState) {
    const params = toQueryParams(state, searchParams);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setFiltersOpen(false);
  }

  function setSort(sort: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort) params.set("sort", sort);
    else params.delete("sort");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const activeCount =
    (initial.inStock ? 1 : 0) +
    (initial.onSale ? 1 : 0) +
    initial.colors.length +
    initial.sizes.length +
    (initial.minPrice !== undefined || initial.maxPrice !== undefined ? 1 : 0);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-soft" aria-live="polite">
        {title ? `${title} · ` : ""}
        {total} {total === 1 ? "article" : "articles"}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="btn btn-ghost min-h-10 px-4 text-xs lg:hidden"
        >
          <SlidersHorizontal size={15} /> Filtres{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <span className="hidden sm:inline">Trier</span>
          <select
            value={initial.sort ?? "featured"}
            onChange={(event) => setSort(event.target.value)}
            className="field min-h-10 w-auto"
            aria-label="Trier les articles"
          >
            {PRODUCT_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="hidden lg:block">
        <aside className="hidden" aria-hidden="true" />
      </div>

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtres">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setFiltersOpen(false)} className="p-1" aria-label="Fermer les filtres">
            <X size={18} className="hidden" />
          </button>
        </div>
        <FiltersForm facets={facets} initial={initial} onApply={apply} />
      </Modal>
    </div>
  );
}

export function DesktopFilters({ facets }: { facets: Facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = useMemo(() => parseFilters(searchParams), [searchParams]);

  function apply(state: FilterState) {
    const params = toQueryParams(state, searchParams);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filtres">
      <div className="sticky top-32 border hairline bg-white p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em]">Filtres</p>
        <FiltersForm facets={facets} initial={initial} onApply={apply} />
      </div>
    </aside>
  );
}
