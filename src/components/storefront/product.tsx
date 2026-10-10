"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Heart, Plus } from "lucide-react";
import { useCart } from "@/components/storefront/cart-ui";
import { useLocale } from "@/lib/i18n/provider";
import { Badge, Button, Modal, Price, QuantitySelector, Stars } from "@/components/ui";
import { getWishlistIdsAction, toggleWishlistAction } from "@/server/actions/engagement";

const GUEST_WISHLIST_KEY = "hanadi-wishlist";

export function readGuestWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_WISHLIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function writeGuestWishlist(ids: string[]): void {
  try {
    window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event("hanadi-wishlist"));
  } catch {
    // storage unavailable — the heart simply stays local to this page view
  }
}

export function clearGuestWishlist(): void {
  writeGuestWishlist([]);
}

import { discountPercent, formatPrice } from "@/lib/money";
import { pixelEvent } from "@/components/pixels";
import {
  isOptionValueAvailableForSelection,
  resolveVariantSelection,
} from "@/lib/variant-selection";
import { cn } from "@/lib/utils";
import type { StoreProduct, StoreProductCard } from "@/server/catalog";

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
  // Served byte-identical (no optimizer recompression): uploads are stored
  // lossless, so any quality setting here would only throw detail away.
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"}
      priority={priority}
      unoptimized
      className={cn("object-cover", className)}
    />
  );
}

/* ----------------------------------------------------------- Product card */

export function ProductCard({ product }: { product: StoreProductCard }) {
  const { t } = useLocale();
  const { add } = useCart();
  const [pending, setPending] = useState(false);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const images = product.images;
  const count = images.length;
  const current = count === 0 ? 0 : index % count;
  const go = (direction: 1 | -1) =>
    setIndex((previous) => (previous + direction + count) % Math.max(count, 1));
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
    <article className="product-card group flex flex-col">
      <div
        className="product-card-media relative overflow-hidden bg-cream transition-transform duration-500"
        role={count > 1 ? "group" : undefined}
        aria-roledescription={count > 1 ? "carousel" : undefined}
        aria-label={count > 1 ? product.name : undefined}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null || count < 2) return;
          const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) < 30) return;
          go(delta < 0 ? 1 : -1);
        }}
      >
        <Link
          href={`/products/${product.slug}`}
          aria-label={product.name}
          className="block aspect-[3/4]"
        >
          <div className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]">
            {images.map((image, imageIndex) => (
              <div
                key={`${image.url}-${imageIndex}`}
                aria-hidden={imageIndex === current ? undefined : true}
                className={cn(
                  "absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  imageIndex === current ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <ProductImage url={image.url} alt={image.alt || product.name} />
              </div>
            ))}
            {count === 0 && <ProductImage url={null} alt={product.name} />}
          </div>
        </Link>
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label={t.product.prevImage}
              onClick={() => go(-1)}
              className="absolute start-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#fff]/10 text-[#fff] opacity-90 backdrop-blur-[2px] drop-shadow-md transition-all duration-200 hover:bg-[#fff]/30 hover:opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <ChevronLeft size={17} className="rtl-flip" />
            </button>
            <button
              type="button"
              aria-label={t.product.nextImage}
              onClick={() => go(1)}
              className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#fff]/10 text-[#fff] opacity-90 backdrop-blur-[2px] drop-shadow-md transition-all duration-200 hover:bg-[#fff]/30 hover:opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <ChevronRight size={17} className="rtl-flip" />
            </button>
            <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
              {images.map((image, imageIndex) => (
                <button
                  key={`dot-${image.url}-${imageIndex}`}
                  type="button"
                  aria-label={t.product.viewImage.replace("{n}", String(imageIndex + 1))}
                  aria-current={imageIndex === current}
                  onClick={() => setIndex(imageIndex)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    imageIndex === current ? "w-5 bg-white" : "w-1.5 bg-white/60 hover:bg-white",
                  )}
                />
              ))}
            </div>
            <span aria-live="polite" className="sr-only">
              {t.product.imageCounter.replace("{current}", String(current + 1)).replace("{total}", String(count))}
            </span>
          </>
        )}
        <div className="absolute start-2 top-2 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <Badge tone="muted">{t.product.badgeSoldOut}</Badge>
          ) : (
            <>
              {percent && <Badge tone="sale">-{percent}%</Badge>}
              {product.isNew && <Badge tone="gold">{t.product.badgeNew}</Badge>}
              {product.isBestseller && !product.isNew && <Badge tone="ink">{t.product.badgeBestSeller}</Badge>}
            </>
          )}
        </div>
        <WishlistButton productId={product.id} className="absolute end-2 top-2" />
        {!soldOut && !product.hasVariants && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void quickAdd()}
            className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-ink/60 via-ink/20 to-transparent pb-3 pt-10 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory opacity-0 transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 md:block"
          >
            {pending ? t.product.adding : t.product.addToBag}
          </button>
        )}
        {!soldOut && !product.hasVariants && (
          <button
            type="button"
            disabled={pending}
            aria-label={`${t.product.addFor} ${product.name} ${t.product.toBag}`}
            onClick={() => void quickAdd()}
            className="absolute bottom-2 end-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#fff]/15 text-[#fff] opacity-90 backdrop-blur-[2px] drop-shadow-md transition-all duration-200 hover:bg-[#fff]/30 hover:opacity-100 md:hidden"
          >
            <Plus size={18} />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center pt-3 text-center">
        <Link
          href={`/products/${product.slug}`}
          className="font-display text-[1.05rem] font-medium leading-snug tracking-wide hover:underline hover:decoration-line hover:underline-offset-4"
        >
          {product.name}
        </Link>
        <div className="mt-1 flex justify-center tracking-[0.04em]">
          <Price price={product.price} compareAt={product.compareAtPrice} />
        </div>
        {product.ratingCount > 0 && (
          <div className="mt-1 flex justify-center">
            <Stars value={product.ratingAvg} count={product.ratingCount} />
          </div>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------ Product carousel */

export function ProductCarousel({
  eyebrow,
  title,
  products,
  viewAllHref,
  mobileGrid = false,
}: {
  eyebrow?: string;
  title: string;
  products: StoreProductCard[];
  viewAllHref?: string;
  mobileGrid?: boolean;
}) {
  const { t } = useLocale();
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="container-luxe" aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-4 border-b hairline pb-4 md:mb-6">
        <div>
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h2 className="font-display text-3xl font-medium uppercase md:text-4xl">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="me-2 hidden text-xs font-medium uppercase tracking-[0.18em] underline underline-offset-4 sm:inline"
            >
              {t.common.viewAll}
            </Link>
          )}
          <button
            type="button"
            aria-label={t.product.scrollLeft}
            onClick={() => scrollBy(-1)}
            className={cn(
              "flex h-10 w-10 items-center justify-center border hairline bg-white",
              mobileGrid && "hidden md:flex",
            )}
          >
            <ChevronLeft size={18} className="rtl-flip" />
          </button>
          <button
            type="button"
            aria-label={t.product.scrollRight}
            onClick={() => scrollBy(1)}
            className={cn(
              "flex h-10 w-10 items-center justify-center border hairline bg-white",
              mobileGrid && "hidden md:flex",
            )}
          >
            <ChevronRight size={18} className="rtl-flip" />
          </button>
        </div>
      </div>
      <div
        ref={trackRef}
        className={cn(
          "shopify-rail motion-stagger -mx-4 px-4 md:mx-0 md:px-0",
          mobileGrid && "mobile-product-grid",
        )}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className={cn("w-[46%] shrink-0 md:w-[18rem]", mobileGrid && "w-full")}
          >
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
  const { t } = useLocale();
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoomPoint, setZoomPoint] = useState({ x: 50, y: 50 });
  const current = images[Math.min(active, images.length - 1)];

  return (
    <div>
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setZoomPoint({
            x: ((event.clientX - rect.left) / rect.width) * 100,
            y: ((event.clientY - rect.top) / rect.height) * 100,
          });
        }}
        className="product-gallery-hero group relative block aspect-[3/4] w-full overflow-hidden bg-cream"
        aria-label={t.product.openGallery}
      >
        <div
          className="product-zoom-frame absolute inset-0"
          style={{ "--zoom-x": `${zoomPoint.x}%`, "--zoom-y": `${zoomPoint.y}%` } as CSSProperties}
        >
          {current ? (
            <ProductImage
              url={current.url}
              alt={current.alt || name}
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
              className="product-zoom-image"
            />
          ) : (
            <ProductImage url={null} alt={name} />
          )}
        </div>
        <span className="product-zoom-hint pointer-events-none absolute bottom-4 start-4 inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-ink-soft opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
          {t.product.zoomHint}
        </span>
      </button>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={t.product.viewImage.replace("{n}", String(index + 1))}
              aria-current={index === active}
              className={cn(
                "product-gallery-thumb relative h-20 w-16 shrink-0 overflow-hidden bg-cream",
                index === active && "product-gallery-thumb-active ring-2 ring-gold ring-offset-2",
              )}
            >
              <ProductImage url={image.url} alt={image.alt || name} sizes="64px" />
            </button>
          ))}
        </div>
      )}
      <Modal open={fullscreen} onClose={() => setFullscreen(false)} title={name}>
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-cream">
          {current && (
            <ProductImage
              url={current.url}
              alt={current.alt || name}
              sizes="(max-width: 640px) 100vw, 480px"
            />
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label={t.product.prevImage}
              onClick={() => setActive((active - 1 + images.length) % images.length)}
              className="flex h-10 w-10 items-center justify-center border hairline"
            >
              <ChevronLeft size={18} className="rtl-flip" />
            </button>
            <span className="text-sm text-ink-muted" aria-live="polite">
              {active + 1} / {images.length}
            </span>
            <button
              type="button"
              aria-label={t.product.nextImage}
              onClick={() => setActive((active + 1) % images.length)}
              className="flex h-10 w-10 items-center justify-center border hairline"
            >
              <ChevronRight size={18} className="rtl-flip" />
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------- Variant picker */

function VariantPicker({
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
                  ? Object.fromEntries(
                      product.options.map((entry) => [
                        entry.name,
                        selected.optionValueIds.find((id) =>
                          entry.values.some((candidate) => candidate.id === id),
                        ) ?? "",
                      ]),
                    )
                  : {};
                const available = isOptionValueAvailableForSelection(
                  product.options,
                  product.variants,
                  currentSelection,
                  option.name,
                  value.id,
                );
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
                        selected
                          ? Object.fromEntries(
                              product.options.map((entry) => [
                                entry.name,
                                selected.optionValueIds.find((id) =>
                                  entry.values.some((candidate) => candidate.id === id),
                                ) ?? "",
                              ]),
                            )
                          : {},
                        option.name,
                        value.id,
                      );
                      if (result.variantId) onChange(result.variantId);
                    }}
                    className={cn(
                      "variant-option flex min-h-10 items-center gap-2 border px-4 text-sm",
                      isActive ? "variant-option-active" : "hairline bg-white",
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
  const { locale, t } = useLocale();
  const { add } = useCart();
  const [variantId, setVariantId] = useState(
    product.defaultVariantId ?? product.variants[0]?.id ?? "",
  );
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
      setError(t.product.optionOutOfStock);
      return;
    }
    setPending(true);
    setError(null);
    const result = await add(selected.id, quantity);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? t.product.addFailed);
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
          {t.product.onlyLeft.replace("{count}", String(selected.available)).replace("{s}", selected.available > 1 ? "s" : "")}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <QuantitySelector value={quantity} onChange={setQuantity} max={Math.max(1, maxQuantity)} />
        <Button
          onClick={() => void submit(false)}
          disabled={pending || maxQuantity <= 0}
          className="flex-1"
        >
          {pending ? t.product.adding : t.product.addToBag}
        </Button>
        <WishlistButton productId={product.id} bordered />
      </div>
      <Button
        variant="gold"
        onClick={() => void submit(true)}
        disabled={pending || maxQuantity <= 0}
        className="mt-3 w-full"
      >
        {t.product.buyNowCod}
      </Button>
      {error && (
        <p className="mt-3 text-sm text-[#9e342e]" role="alert">
          {error}
        </p>
      )}

      {/* Sticky one-thumb buy bar — mobile only, the premium COD shortcut. */}
      <div className="h-[4.5rem] md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-ivory pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_35px_-24px_rgb(29_35_43/0.45)] md:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="text-sm text-ink-soft">
              {selected
                ? formatPrice(selected.price, { locale })
                : formatPrice(product.price, { locale })}
              {selected?.optionLabel && (
                <span className="text-ink-muted"> · {selected.optionLabel}</span>
              )}
            </p>
          </div>
          <Button
            onClick={() => void submit(false)}
            disabled={pending || maxQuantity <= 0}
            size="sm"
            className="shrink-0 px-6"
          >
            {pending ? t.product.adding : maxQuantity <= 0 ? t.product.soldOut : t.product.add}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Wishlist button */

function WishlistButton({
  productId,
  className,
  bordered,
}: {
  productId: string;
  className?: string;
  bordered?: boolean;
}) {
  const { t } = useLocale();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getWishlistIdsAction()
      .then((state) => {
        if (cancelled) return;
        setSaved(
          state.loggedIn ? state.ids.includes(productId) : readGuestWishlist().includes(productId),
        );
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
      const next = ids.includes(productId)
        ? ids.filter((id) => id !== productId)
        : [...ids, productId];
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
      aria-label={saved ? t.product.removeWishlist : t.product.addWishlist}
      aria-pressed={saved ?? false}
      className={cn(
        "flex h-9 w-9 items-center justify-center transition-all duration-200 disabled:opacity-50",
        bordered
          ? "h-[2.875rem] w-[2.875rem] border hairline bg-white shadow-none"
          : "bg-transparent opacity-90 hover:bg-[#fff]/20 hover:opacity-100 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        saved && !bordered && "md:opacity-100",
        className,
      )}
    >
      <Heart
        size={17}
        className={
          saved
            ? "fill-sale text-sale drop-shadow-md"
            : bordered
              ? "text-ink"
              : "text-[#fff] drop-shadow-md"
        }
      />
    </button>
  );
}
