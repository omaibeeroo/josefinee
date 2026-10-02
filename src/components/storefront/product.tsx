"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Heart, Plus } from "lucide-react";
import { useCart } from "@/components/storefront/cart-ui";
import { Badge, Button, Modal, Price, QuantitySelector, Stars } from "@/components/ui";
import { getWishlistIdsAction, toggleWishlistAction } from "@/server/actions/engagement";

const GUEST_WISHLIST_KEY = "nur-wishlist";

export function readGuestWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_WISHLIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function writeGuestWishlist(ids: string[]): void {
  try {
    window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event("nur-wishlist"));
  } catch {
    // storage unavailable — the heart simply stays local to this page view
  }
}

export function clearGuestWishlist(): void {
  writeGuestWishlist([]);
}

const RECENT_KEY = "nur-recently-viewed";
const RECENT_MAX = 12;

export function recordRecentlyViewed(productId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const ids = (Array.isArray(parsed) ? parsed : []).filter(
      (entry): entry is string => typeof entry === "string",
    );
    const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // private browsing — recently viewed simply stays empty
  }
}

function readRecentlyViewed(excludeId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is string => typeof entry === "string" && entry !== excludeId,
    );
  } catch {
    return [];
  }
}

export function RecentlyViewed({ productId }: { productId: string }) {
  const [products, setProducts] = useState<StoreProductCard[] | null>(null);

  useEffect(() => {
    recordRecentlyViewed(productId);
    let cancelled = false;
    void getProductsByIdsAction(readRecentlyViewed(productId))
      .then((items) => {
        if (!cancelled && items.length > 0) setProducts(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!products) return null;
  return <ProductCarousel title="Consultés récemment" products={products} />;
}
import { discountPercent, formatPrice } from "@/lib/money";
import { pixelEvent } from "@/components/pixels";
import { isOptionValueAvailableForSelection, resolveVariantSelection } from "@/lib/variant-selection";
import { cn } from "@/lib/utils";
import type { QuickAddData, StoreProduct, StoreProductCard } from "@/server/catalog";
import { getProductsByIdsAction, getQuickAddAction } from "@/server/actions/cart";

/* --------------------------------------------------------- Image fallback */

export function ProductImage({
  url,
  alt,
  className,
  sizes,
  priority,
}: {
  url: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!url) {
    return (
      <span className={cn("flex h-full w-full items-center justify-center bg-cream", className)}>
        <span className="font-display text-5xl text-ink-muted/60">{alt.charAt(0)}</span>
      </span>
    );
  }
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"}
      priority={priority}
      className={cn("object-cover", className)}
    />
  );
}

/* ----------------------------------------------------------- Product card */

export function ProductCard({ product }: { product: StoreProductCard }) {
  const { add } = useCart();
  const [quickOpen, setQuickOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const main = product.images[0];
  const hover = product.images[1];
  const percent = discountPercent(product.price, product.compareAtPrice);
  const soldOut = !product.inStock;

  async function quickAdd() {
    if (!product.defaultVariantId) return;
    setPending(true);
    const result = await add(product.defaultVariantId, 1);
    setPending(false);
    if (result.ok) {
      pixelEvent("AddToCart", { content_ids: [product.id], value: product.price, currency: "DZD" });
    }
  }

  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden bg-cream">
        <Link href={`/products/${product.slug}`} aria-label={product.name} className="block aspect-[3/4]">
          <div className="absolute inset-0 transition-all duration-500 ease-out group-hover:scale-[1.04] group-hover:opacity-0">
            <ProductImage url={main?.url ?? null} alt={product.name} />
          </div>
          {hover && (
            <div className="absolute inset-0 scale-[1.04] opacity-0 transition-all duration-500 ease-out group-hover:scale-100 group-hover:opacity-100">
              <ProductImage url={hover.url} alt={product.name} />
            </div>
          )}
        </Link>
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <Badge tone="muted">Épuisé</Badge>
          ) : (
            <>
              {percent && <Badge tone="sale">-{percent}%</Badge>}
              {product.isNew && <Badge tone="gold">Nouveau</Badge>}
              {product.isBestseller && !product.isNew && <Badge tone="ink">Meilleure vente</Badge>}
            </>
          )}
        </div>
        <WishlistButton productId={product.id} className="absolute right-2 top-2" />
        {!soldOut && (
          <button
            type="button"
            disabled={pending}
            onClick={() => (product.hasVariants ? setQuickOpen(true) : void quickAdd())}
            className="absolute inset-x-0 bottom-0 hidden translate-y-2 bg-ink/90 py-3 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory opacity-0 transition-all duration-200 hover:bg-ink group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 md:block"
          >
            {pending ? "Ajout…" : product.hasVariants ? "Choisir les options" : "Ajouter au panier"}
          </button>
        )}
        {!soldOut && (
          <button
            type="button"
            disabled={pending}
            aria-label={product.hasVariants ? `Choisir les options pour ${product.name}` : `Ajouter ${product.name} au panier`}
            onClick={() => (product.hasVariants ? setQuickOpen(true) : void quickAdd())}
            className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-ivory shadow-card md:hidden"
          >
            <Plus size={18} />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col pt-3">
        <Link href={`/products/${product.slug}`} className="text-[0.9375rem] font-medium leading-snug hover:underline">
          {product.name}
        </Link>
        <div className="mt-1">
          <Price price={product.price} compareAt={product.compareAtPrice} />
        </div>
        {product.ratingCount > 0 && (
          <div className="mt-1">
            <Stars value={product.ratingAvg} count={product.ratingCount} />
          </div>
        )}
      </div>
      {product.hasVariants && (
        <QuickAddModal product={product} open={quickOpen} onClose={() => setQuickOpen(false)} />
      )}
    </article>
  );
}

/* -------------------------------------------------------- Quick add modal */

export function QuickAddModal({
  product,
  open,
  onClose,
}: {
  product: StoreProductCard;
  open: boolean;
  onClose: () => void;
}) {
  const { add } = useCart();
  const [data, setData] = useState<QuickAddData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open || data || !product.hasVariants) return;
    let cancelled = false;
    setLoading(true);
    void getQuickAddAction(product.id)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product.id]);

  const matched = useMemo(() => {
    if (!data) return null;
    const chosen = Object.values(selected).filter(Boolean);
    if (chosen.length < data.options.length) return null;
    return (
      data.variants.find((variant) =>
        chosen.every((valueId) => variant.optionValueIds.includes(valueId)),
      ) ?? null
    );
  }, [data, selected]);

  const activeVariant = data ? (matched ?? (data.options.length === 0 ? data.variants[0] ?? null : null)) : null;
  const maxQuantity = Math.min(10, activeVariant?.available ?? 0);

  useEffect(() => {
    setQuantity((current) => Math.min(current, Math.max(1, maxQuantity)));
  }, [maxQuantity]);

  async function submit() {
    const variantId = product.hasVariants ? activeVariant?.id : product.defaultVariantId;
    if (!variantId) {
      setError("Please choose your options first.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await add(variantId, product.hasVariants ? quantity : 1);
    setPending(false);
    if (result.ok) {
      pixelEvent("AddToCart", { content_ids: [product.id], currency: "DZD" });
      onClose();
    } else {
      setError(result.error ?? "Could not add to bag.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={product.name}>
      <div className="flex gap-4">
        <div className="relative h-28 w-24 shrink-0 overflow-hidden bg-cream">
          <ProductImage url={data?.image?.url ?? product.images[0]?.url ?? null} alt={product.name} sizes="96px" />
        </div>
        <div>
          <Price
            price={activeVariant?.price ?? product.price}
            compareAt={activeVariant?.compareAtPrice ?? product.compareAtPrice}
          />
          {!product.inStock && <p className="mt-1 text-sm text-sale">Out of stock</p>}
          {activeVariant && activeVariant.available <= 3 && activeVariant.available > 0 && (
            <p className="mt-1 text-sm font-medium text-sale" role="status">
              Only {activeVariant.available} left
            </p>
          )}
        </div>
      </div>

      {loading && <p className="mt-4 text-sm text-ink-soft">Loading options…</p>}

      {data && data.options.length > 0 && (
        <div className="mt-4 space-y-3">
          {data.options.map((option) => (
            <div key={option.name}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">
                {option.name}
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={option.name}>
                {option.values.map((value) => {
                  const isActive = selected[option.name] === value.id;
                  const available = isOptionValueAvailableForSelection(data.options, data.variants, selected, option.name, value.id);
                  return (
                    <button
                      key={value.id}
                      type="button"
                      aria-pressed={isActive}
                      disabled={!available}
                      onClick={() => {
                        setError(null);
                        setSelected((previous) =>
                          resolveVariantSelection(data.options, data.variants, previous, option.name, value.id).selection,
                        );
                      }}
                      className={cn(
                        "flex min-h-10 items-center gap-2 border px-4 text-sm transition-colors",
                        isActive ? "border-ink bg-ink text-ivory" : "hairline bg-white",
                        !available && "opacity-40 line-through",
                      )}
                    >
                      {value.hexColor && (
                        <span
                          className="h-3.5 w-3.5 rounded-full border hairline"
                          style={{ backgroundColor: value.hexColor }}
                          aria-hidden="true"
                        />
                      )}
                      {value.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {product.hasVariants && (
        <div className="mt-4 flex items-center gap-3">
          <QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, maxQuantity)} />
          <span className="text-xs text-ink-muted">Select options to see availability</span>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <Button
          onClick={() => void submit()}
          disabled={pending || loading || !product.inStock || (product.hasVariants && !activeVariant)}
          className="flex-1"
        >
          {pending ? "Adding…" : "Add to bag"}
        </Button>
        <Link href={`/products/${product.slug}`} onClick={onClose} className="btn btn-ghost flex-1 text-center">
          Full details
        </Link>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------ Product carousel */

export function ProductCarousel({
  eyebrow,
  title,
  products,
  viewAllHref,
}: {
  eyebrow?: string;
  title: string;
  products: StoreProductCard[];
  viewAllHref?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="container-luxe" aria-label={title}>
      <div className="mb-6 flex items-end justify-between gap-4 border-b hairline pb-5 md:mb-8">
        <div>
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h2 className="font-display text-3xl font-medium md:text-4xl">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Link href={viewAllHref} className="mr-2 hidden text-xs font-medium uppercase tracking-[0.18em] underline underline-offset-4 sm:inline">
              Voir tout
            </Link>
          )}
          <button type="button" aria-label="Faire défiler vers la gauche" onClick={() => scrollBy(-1)} className="flex h-10 w-10 items-center justify-center border hairline bg-white">
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Faire défiler vers la droite" onClick={() => scrollBy(1)} className="flex h-10 w-10 items-center justify-center border hairline bg-white">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        ref={trackRef}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-5"
      >
        {products.map((product) => (
          <div key={product.id} className="w-[46%] shrink-0 snap-start md:w-auto">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------- Product gallery */

export function ProductGallery({
  images,
  name,
}: {
  images: Array<{ url: string; alt: string }>;
  name: string;
}) {
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const current = images[Math.min(active, images.length - 1)];

  return (
    <div>
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        className="relative block aspect-[3/4] w-full overflow-hidden bg-cream"
        aria-label="Open fullscreen gallery"
      >
        {current ? (
          <ProductImage url={current.url} alt={current.alt || name} sizes="(max-width: 768px) 100vw, 50vw" priority />
        ) : (
          <ProductImage url={null} alt={name} />
        )}
      </button>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`View image ${index + 1}`}
              aria-current={index === active}
              className={cn(
                "relative h-20 w-16 shrink-0 overflow-hidden bg-cream",
                index === active && "ring-2 ring-gold ring-offset-2",
              )}
            >
              <ProductImage url={image.url} alt={image.alt || name} sizes="64px" />
            </button>
          ))}
        </div>
      )}
      <Modal open={fullscreen} onClose={() => setFullscreen(false)} title={name}>
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-cream">
          {current && <ProductImage url={current.url} alt={current.alt || name} sizes="(max-width: 640px) 100vw, 480px" />}
        </div>
        {images.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => setActive((active - 1 + images.length) % images.length)}
              className="flex h-10 w-10 items-center justify-center border hairline"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-ink-muted" aria-live="polite">
              {active + 1} / {images.length}
            </span>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => setActive((active + 1) % images.length)}
              className="flex h-10 w-10 items-center justify-center border hairline"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------- Variant picker */

export function VariantPicker({
  product,
  selectedVariantId,
  onChange,
}: {
  product: StoreProduct;
  selectedVariantId: string;
  onChange: (variantId: string) => void;
}) {
  if (product.options.length === 0) return null;

  const selected = product.variants.find((variant) => variant.id === selectedVariantId);

  return (
    <div className="space-y-4">
      {product.options.map((option) => {
        const activeValueId = selected?.optionValueIds.find((id) =>
          option.values.some((value) => value.id === id),
        );
        return (
          <div key={option.name}>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">
              {option.name}
              {activeValueId && (
                <span className="ml-2 normal-case tracking-normal text-ink">
                  {option.values.find((value) => value.id === activeValueId)?.value}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={option.name}>
              {option.values.map((value) => {
                const currentSelection = selected
                  ? Object.fromEntries(product.options.map((entry) => [
                      entry.name,
                      selected.optionValueIds.find((id) => entry.values.some((candidate) => candidate.id === id)) ?? "",
                    ]))
                  : {};
                const available = isOptionValueAvailableForSelection(product.options, product.variants, currentSelection, option.name, value.id);
                const isActive = activeValueId === value.id;
                return (
                  <button
                    key={value.id}
                    type="button"
                    aria-pressed={isActive}
                    disabled={!available}
                    onClick={() => {
                      const result = resolveVariantSelection(
                        product.options,
                        product.variants,
                        selected ? Object.fromEntries(product.options.map((entry) => [
                          entry.name,
                          selected.optionValueIds.find((id) => entry.values.some((candidate) => candidate.id === id)) ?? "",
                        ])) : {},
                        option.name,
                        value.id,
                      );
                      if (result.variantId) onChange(result.variantId);
                    }}
                    className={cn(
                      "flex min-h-10 items-center gap-2 border px-4 text-sm transition-colors",
                      isActive ? "border-ink bg-ink text-ivory" : "hairline bg-white",
                      !available && "opacity-40 line-through",
                    )}
                  >
                    {value.hexColor && (
                      <span
                        className="h-3.5 w-3.5 rounded-full border hairline"
                        style={{ backgroundColor: value.hexColor }}
                        aria-hidden="true"
                      />
                    )}
                    {value.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------ Add to bag panel */

export function AddToBagPanel({ product }: { product: StoreProduct }) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState(product.defaultVariantId ?? product.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selected = useMemo(
    () => product.variants.find((variant) => variant.id === variantId),
    [product.variants, variantId],
  );
  const maxQuantity = Math.min(10, selected?.available ?? 0);

  useEffect(() => {
    setQuantity((current) => Math.min(current, Math.max(1, maxQuantity)));
  }, [maxQuantity]);

  async function submit(buyNow: boolean) {
    if (!selected || selected.available <= 0) {
      setError("This option is out of stock.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await add(selected.id, quantity);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not add to bag.");
      return;
    }
    pixelEvent("AddToCart", {
      content_ids: [product.id],
      value: selected.price * quantity,
      currency: "DZD",
    });
    if (buyNow) {
      window.location.href = "/checkout";
    }
  }

  return (
    <div className="mt-6">
      <VariantPicker product={product} selectedVariantId={variantId} onChange={setVariantId} />
      <div className="mt-4">
        <Price
          price={selected?.price ?? product.price}
          compareAt={selected?.compareAtPrice ?? product.compareAtPrice}
          large
        />
      </div>
      {selected?.available !== undefined && selected.available <= 3 && selected.available > 0 && (
        <p className="mt-3 text-sm font-medium text-sale" role="status">
          Only {selected.available} left in stock
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, maxQuantity)} />
        <Button
          onClick={() => void submit(false)}
          disabled={pending || maxQuantity <= 0}
          className="flex-1"
        >
          {pending ? "Adding…" : "Add to bag"}
        </Button>
        <WishlistButton productId={product.id} bordered />
      </div>
      <Button
        variant="gold"
        onClick={() => void submit(true)}
        disabled={pending || maxQuantity <= 0}
        className="mt-3 w-full"
      >
        Buy now — cash on delivery
      </Button>
      {error && (
        <p className="mt-3 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}

      {/* Sticky one-thumb buy bar — mobile only, the premium COD shortcut. */}
      <div className="h-[4.5rem] md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-sm text-ink-soft">
              {selected ? formatPrice(selected.price) : formatPrice(product.price)}
              {selected?.optionLabel && <span className="text-ink-muted"> · {selected.optionLabel}</span>}
            </p>
          </div>
          <Button
            onClick={() => void submit(false)}
            disabled={pending || maxQuantity <= 0}
            size="sm"
            className="shrink-0 px-6"
          >
            {pending ? "Adding…" : maxQuantity <= 0 ? "Sold out" : "Add to bag"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Wishlist button */

export function WishlistButton({
  productId,
  className,
  bordered,
}: {
  productId: string;
  className?: string;
  bordered?: boolean;
}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getWishlistIdsAction()
      .then((state) => {
        if (cancelled) return;
        setSaved(state.loggedIn ? state.ids.includes(productId) : readGuestWishlist().includes(productId));
      })
      .catch(() => {
        if (!cancelled) setSaved(readGuestWishlist().includes(productId));
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function toggle() {
    setPending(true);
    const result = await toggleWishlistAction(productId);
    setPending(false);
    if (result.ok) {
      setSaved(result.saved);
      if (result.saved) pixelEvent("AddToWishlist", { content_ids: [productId] });
      return;
    }
    if (result.code === "NEED_LOGIN") {
      // Guests keep a local wishlist, merged into their account on login.
      const ids = readGuestWishlist();
      const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId];
      writeGuestWishlist(next);
      setSaved(next.includes(productId));
      if (next.includes(productId)) pixelEvent("AddToWishlist", { content_ids: [productId] });
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void toggle()}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved ?? false}
      className={cn(
        "flex h-9 w-9 items-center justify-center bg-ivory/90 shadow-card transition-colors hover:bg-ivory disabled:opacity-50",
        bordered && "h-[2.875rem] w-[2.875rem] border hairline bg-white shadow-none",
        className,
      )}
    >
      <Heart size={17} className={saved ? "fill-sale text-sale" : "text-ink"} />
    </button>
  );
}
