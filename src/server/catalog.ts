import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, type ProductSort } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { CACHE_TAG_CATALOG, CATALOG_REVALIDATE_SECONDS, stableCatalogQueryKey } from "@/lib/cache";
import { Prisma } from "@prisma/client";

export type StoreProductCard = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  isNew: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  images: Array<{ url: string; alt: string }>;
  inStock: boolean;
  hasVariants: boolean;
  defaultVariantId: string | null;
  options: Array<{ name: string; values: Array<{ id: string; value: string; hexColor: string | null }> }>;
  category: { name: string; slug: string } | null;
};

export type StoreProduct = StoreProductCard & {
  collectionIds: string[];
  description: string;
  shortDescription: string | null;
  sku: string | null;
  material: string | null;
  color: string | null;
  size: string | null;
  weight: number | null;
  dimensions: string | null;
  careInstructions: string | null;
  shippingInfo: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: Array<{
    id: string;
    sku: string;
    price: number;
    compareAtPrice: number | null;
    imageUrl: string | null;
    optionLabel: string | null;
    available: number;
    optionValueIds: string[];
  }>;
};

const cardInclude = Prisma.validator<Prisma.ProductInclude>()({
  // Up to 6 photos feed the card image carousel (arrows/dots/swipe).
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 6 },
  // Availability comes from getCardAvailability (raw SQL); only the fallback
  // variant id is needed here — never fetch per-variant inventory rows.
  variants: {
    where: { isActive: true },
    orderBy: { position: "asc" },
    take: 1,
    select: { id: true },
  },
  category: { select: { name: true, slug: true } },
  options: { select: { id: true }, take: 1 },
});

type ProductWithCardRelations = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

/** Null publication dates are legacy immediate-publication records. */
export function storefrontProductWhere(now = new Date()): Prisma.ProductWhereInput {
  return {
    status: "ACTIVE",
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  };
}

type CardAvailability = { productId: string; inStock: boolean; defaultVariantId: string | null };

async function getCardAvailability(productIds: string[]): Promise<Map<string, CardAvailability>> {
  if (productIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<CardAvailability[]>(Prisma.sql`
    SELECT v."productId" AS "productId",
      BOOL_OR(COALESCE(i."stock", 0) > COALESCE(i."reserved", 0)) AS "inStock",
      (ARRAY_AGG(v."id" ORDER BY
        (COALESCE(i."stock", 0) > COALESCE(i."reserved", 0)) DESC,
        v."position" ASC, v."id" ASC))[1] AS "defaultVariantId"
    FROM "ProductVariant" v
    LEFT JOIN "Inventory" i ON i."variantId" = v."id"
    WHERE v."isActive" = TRUE AND v."productId" IN (${Prisma.join(productIds)})
    GROUP BY v."productId"
  `);
  return new Map(rows.map((row) => [row.productId, row]));
}

async function getAvailableProductIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ productId: string }>>(Prisma.sql`
    SELECT DISTINCT v."productId" AS "productId"
    FROM "ProductVariant" v
    INNER JOIN "Inventory" i ON i."variantId" = v."id"
    WHERE v."isActive" = TRUE AND i."stock" > i."reserved"
  `);
  return rows.map((row) => row.productId);
}

async function mapProductCards(products: ProductWithCardRelations[]): Promise<StoreProductCard[]> {
  const availability = await getCardAvailability(products.map((product) => product.id));
  return products.map((product) => mapProductCard(product, availability.get(product.id)));
}

function mapProductCard(
  product: ProductWithCardRelations,
  availability?: CardAvailability,
): StoreProductCard {
  const variant = product.variants[0];
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    isFeatured: product.isFeatured,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    soldCount: product.soldCount,
    images: product.images.map((image) => ({ url: image.url, alt: image.alt ?? product.name })),
    inStock: availability?.inStock ?? false,
    hasVariants: product.options.length > 0,
    defaultVariantId: availability?.defaultVariantId ?? variant?.id ?? null,
    options: [],
    category: product.category,
  };
}

export type CatalogQuery = {
  ids?: string[];
  categorySlug?: string;
  categorySlugs?: string[];
  collectionSlug?: string;
  type?: "NEW_IN" | "BEST_SELLERS" | "SALE";
  tag?: string;
  search?: string;
  onSale?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

function orderByFor(sort: ProductSort | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }];
    case "price-asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price-desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "best-selling":
      return [{ soldCount: "desc" }, { id: "asc" }];
    case "featured":
    default:
      return [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }];
  }
}

function buildWhere(query: CatalogQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [storefrontProductWhere()];

  if (query.ids?.length) {
    and.push({ id: { in: query.ids } });
  }
  const categorySlugs = query.categorySlugs ?? (query.categorySlug ? [query.categorySlug] : []);
  if (categorySlugs.length > 0) {
    and.push({ category: { slug: { in: categorySlugs }, isActive: true } });
  }
  if (query.collectionSlug) {
    const automaticType = query.type === "NEW_IN" || query.type === "BEST_SELLERS" || query.type === "SALE";
    if (!automaticType) {
      and.push({
        collectionLinks: { some: { collection: { slug: query.collectionSlug, isActive: true } } },
      });
    }
  }
  if (query.tag) and.push({ tags: { has: query.tag } });
  if (query.onSale || query.type === "SALE") {
    and.push({ compareAtPrice: { not: null } });
  }
  if (typeof query.minPrice === "number" || typeof query.maxPrice === "number") {
    const price: Prisma.IntFilter = {};
    if (typeof query.minPrice === "number") price.gte = query.minPrice;
    if (typeof query.maxPrice === "number") price.lte = query.maxPrice;
    and.push({ price });
  }
  if (query.colors?.length) and.push({ color: { in: query.colors } });
  if (query.sizes?.length) and.push({ size: { in: query.sizes } });
  if (query.type === "NEW_IN") and.push({ isNew: true });
  if (query.type === "BEST_SELLERS") and.push({ isBestseller: true });
  if (query.search) {
    const term = query.search.trim();
    if (term.length > 0) {
      and.push({
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { sku: { equals: term, mode: "insensitive" } },
          { brand: { contains: term, mode: "insensitive" } },
          { tags: { has: term.toLowerCase() } },
        ],
      });
    }
  }
  return { AND: and };
}

async function getStorefrontProductsFresh(query: CatalogQuery): Promise<{
  items: StoreProductCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, query.page ?? 1);
  // Listing density comes from Admin → Vitrine (commerce settings), clamped here too.
  const settings = await getSettings();
  const configured = settings.commerce.catalogPageSize;
  const pageSize = Math.min(48, query.pageSize ?? configured ?? PAGE_SIZE);
  let where = buildWhere(query);

  try {
    if (query.inStock) {
      where = { AND: [where, { id: { in: await getAvailableProductIds() } }] };
    }
    // Manual collection with default sort follows the vitrine order
    // (CollectionProduct.sortOrder) instead of the global product order.
    if (query.collectionSlug && !query.sort && !query.type && !query.search) {
      const manual = await prisma.collection.findFirst({
        where: { slug: query.collectionSlug, isActive: true, type: "MANUAL" },
        select: { id: true },
      });
      if (manual) {
        const links = await prisma.collectionProduct.findMany({
          where: {
            collectionId: manual.id,
            product: { AND: Array.isArray((where as { AND?: unknown }).AND) ? (where as { AND: Prisma.ProductWhereInput[] }).AND : [where] },
          },
          orderBy: [{ sortOrder: "asc" }, { productId: "asc" }],
          select: { productId: true },
        });
        const orderedIds = [...new Set(links.map((link) => link.productId))];
        const total = orderedIds.length;
        const pageIds = orderedIds.slice((page - 1) * pageSize, page * pageSize);
        if (pageIds.length === 0) {
          return { items: [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
        }
        const rows = await prisma.product.findMany({
          where: { id: { in: pageIds } },
          include: cardInclude,
        });
        const rank = new Map(pageIds.map((id, index) => [id, index] as const));
        rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
        return {
          items: await mapProductCards(rows),
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
      }
    }
    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: cardInclude,
        orderBy: orderByFor(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items: await mapProductCards(rows),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (error) {
    console.error("[catalog] list failed", error instanceof Error ? error.name : "unknown");
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }
}

const getStorefrontProductsCached = unstable_cache(
  async (key: string) => getStorefrontProductsFresh(JSON.parse(key) as CatalogQuery),
  ["catalog:products"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_CATALOG] },
);

/** Cached storefront listing (see src/lib/cache.ts for scope rules). */
export async function getStorefrontProducts(query: CatalogQuery) {
  // Search terms are unbounded and unrepeatable — caching them would grow
  // the data cache without bound (one entry per unique query). Searches
  // always read live; everything else shares stable keyed entries.
  if (query.search?.trim()) {
    return getStorefrontProductsFresh({ ...query, search: query.search.trim() });
  }
  return getStorefrontProductsCached(stableCatalogQueryKey(query));
}

async function getProductBySlugFresh(slug: string): Promise<StoreProduct | null> {
  const product = await prisma.product.findFirst({
      where: { slug, ...storefrontProductWhere() },
      include: {
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        category: { select: { name: true, slug: true } },
        options: {
          orderBy: { position: "asc" },
          include: { values: { orderBy: { position: "asc" } } },
        },
        variants: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          include: { inventory: true, optionValues: true },
        },
        collectionLinks: { include: { collection: { select: { name: true, slug: true } } } },
      },
    });

  if (!product) return null;

  const variantList = product.variants;
  const base: StoreProductCard = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    isFeatured: product.isFeatured,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    soldCount: product.soldCount,
    images: product.images.map((image) => ({ url: image.url, alt: image.alt ?? product.name })),
    inStock: variantList.some((variant) => (variant.inventory?.stock ?? 0) - (variant.inventory?.reserved ?? 0) > 0),
    hasVariants: product.options.length > 0,
    defaultVariantId:
      variantList.find(
        (entry) => (entry.inventory?.stock ?? 0) - (entry.inventory?.reserved ?? 0) > 0,
      )?.id ?? variantList[0]?.id ?? null,
    options: product.options.map((option) => ({
      name: option.name,
      values: option.values.map((value) => ({
        id: value.id,
        value: value.value,
        hexColor: value.hexColor,
      })),
    })),
    category: product.category,
  };

  return {
    ...base,
    collectionIds: product.collectionLinks.map((entry) => entry.collectionId),
    description: product.description,
    shortDescription: product.shortDescription,
    sku: product.sku,
    material: product.material,
    color: product.color,
    size: product.size,
    weight: product.weight,
    dimensions: product.dimensions,
    careInstructions: product.careInstructions,
    shippingInfo: product.shippingInfo,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    variants: variantList.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price: variant.price ?? product.price,
      compareAtPrice: variant.compareAtPrice ?? product.compareAtPrice,
      imageUrl: variant.imageUrl,
      optionLabel: variant.optionLabel,
      available: Math.max(
        0,
        (variant.inventory?.stock ?? 0) - (variant.inventory?.reserved ?? 0),
      ),
      optionValueIds: variant.optionValues.map((entry) => entry.optionValueId),
    })),
  };
}

const getProductBySlugCached = unstable_cache(
  async (slug: string) => getProductBySlugFresh(slug),
  ["catalog:product-by-slug"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_CATALOG] },
);

/** Cached product detail (see src/lib/cache.ts for scope rules). */
export async function getProductBySlug(slug: string): Promise<StoreProduct | null> {
  return getProductBySlugCached(slug);
}

export type QuickAddData = {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  image: { url: string; alt: string } | null;
  options: Array<{
    name: string;
    values: Array<{ id: string; value: string; hexColor: string | null }>;
  }>;
  variants: Array<{
    id: string;
    price: number;
    compareAtPrice: number | null;
    available: number;
    optionLabel: string | null;
    optionValueIds: string[];
  }>;
};

/** Minimal option/variant payload for the quick-add modal (fetched on open). */
export async function getQuickAddData(productId: string): Promise<QuickAddData | null> {
  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, ...storefrontProductWhere() },
      select: {
        id: true,
        name: true,
        price: true,
        compareAtPrice: true,
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: { url: true, alt: true },
        },
        options: {
          orderBy: { position: "asc" },
          select: {
            name: true,
            values: {
              orderBy: { position: "asc" },
              select: { id: true, value: true, hexColor: true },
            },
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: {
            id: true,
            price: true,
            compareAtPrice: true,
            optionLabel: true,
            inventory: { select: { stock: true, reserved: true } },
            optionValues: { select: { optionValueId: true } },
          },
        },
      },
    });
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      image: product.images[0]
        ? { url: product.images[0].url, alt: product.images[0].alt ?? product.name }
        : null,
      options: product.options,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        price: variant.price ?? product.price,
        compareAtPrice: variant.compareAtPrice ?? product.compareAtPrice,
        available: Math.max(
          0,
          (variant.inventory?.stock ?? 0) - (variant.inventory?.reserved ?? 0),
        ),
        optionLabel: variant.optionLabel,
        optionValueIds: variant.optionValues.map((entry) => entry.optionValueId),
      })),
    };
  } catch (error) {
    console.error("[catalog] quick-add failed", error instanceof Error ? error.name : "unknown");
    return null;
  }
}

async function getRelatedProductsFresh(productId: string, categoryId: string | null, take = 8) {
  const safeTake = Math.min(24, Math.max(1, Math.floor(take) || 8));
  const rows = await prisma.product.findMany({
    where: {
      ...storefrontProductWhere(),
      id: { not: productId },
      ...(categoryId ? { categoryId } : {}),
    },
    include: cardInclude,
    orderBy: [{ isBestseller: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    take: safeTake,
  });
  return mapProductCards(rows);
}

const getRelatedProductsCached = unstable_cache(
  async (productId: string, categoryId: string | null, take: number) =>
    getRelatedProductsFresh(productId, categoryId, take),
  ["catalog:related"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_CATALOG] },
);

/** Cached related-products rail (see src/lib/cache.ts for scope rules). */
export async function getRelatedProducts(productId: string, categoryId: string | null, take = 8) {
  return getRelatedProductsCached(productId, categoryId, take);
}

async function getFeaturedProductsFresh(take = 10) {
  try {
    const rows = await prisma.product.findMany({
      where: { AND: [storefrontProductWhere(), { OR: [{ isFeatured: true }, { isBestseller: true }] }] },
      include: cardInclude,
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      take,
    });
    return await mapProductCards(rows);
  } catch (error) {
    console.error("[catalog] featured failed", error instanceof Error ? error.name : "unknown");
    return [];
  }
}

const getFeaturedProductsCached = unstable_cache(
  async (take: number) => getFeaturedProductsFresh(take),
  ["catalog:featured"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_CATALOG] },
);

/** Cached featured rail (see src/lib/cache.ts for scope rules). */
export async function getFeaturedProducts(take = 10) {
  return getFeaturedProductsCached(take);
}

async function getNewInProductsFresh(take = 10) {
  try {
    const rows = await prisma.product.findMany({
      where: { AND: [storefrontProductWhere(), { isNew: true }] },
      include: cardInclude,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take,
    });
    return await mapProductCards(rows);
  } catch (error) {
    console.error("[catalog] new-in failed", error instanceof Error ? error.name : "unknown");
    return [];
  }
}

const getNewInProductsCached = unstable_cache(
  async (take: number) => getNewInProductsFresh(take),
  ["catalog:new-in"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_CATALOG] },
);

/** Cached new-arrivals rail (see src/lib/cache.ts for scope rules). */
export async function getNewInProducts(take = 10) {
  return getNewInProductsCached(take);
}

async function getBestSellersFresh(take = 10) {
  try {
    const rows = await prisma.product.findMany({
      where: storefrontProductWhere(),
      include: cardInclude,
      orderBy: [{ soldCount: "desc" }, { isBestseller: "desc" }, { id: "asc" }],
      take,
    });
    return await mapProductCards(rows);
  } catch (error) {
    console.error("[catalog] best sellers failed", error instanceof Error ? error.name : "unknown");
    return [];
  }
}

const getBestSellersCached = unstable_cache(
  async (take: number) => getBestSellersFresh(take),
  ["catalog:best-sellers"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_CATALOG] },
);

/** Cached best-sellers rail (see src/lib/cache.ts for scope rules). */
export async function getBestSellers(take = 10) {
  return getBestSellersCached(take);
}

