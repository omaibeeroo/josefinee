import "server-only";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, type ProductSort } from "@/lib/constants";
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
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 2 },
  variants: {
    where: { isActive: true },
    orderBy: { position: "asc" },
    take: 1,
    include: { inventory: true },
  },
  category: { select: { name: true, slug: true } },
  options: { select: { id: true }, take: 1 },
});

type ProductWithCardRelations = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export function mapProductCard(product: ProductWithCardRelations): StoreProductCard {
  const variant = product.variants[0];
  const stock = variant?.inventory?.stock ?? 0;
  const reserved = variant?.inventory?.reserved ?? 0;
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
    inStock: stock - reserved > 0,
    hasVariants: product.options.length > 0,
    defaultVariantId: variant?.id ?? null,
    options: [],
    category: product.category,
  };
}

export type CatalogQuery = {
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
      return [{ publishedAt: "desc" }, { createdAt: "desc" }];
    case "price-asc":
      return [{ price: "asc" }];
    case "price-desc":
      return [{ price: "desc" }];
    case "best-selling":
      return [{ soldCount: "desc" }];
    case "featured":
    default:
      return [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }];
  }
}

export function buildWhere(query: CatalogQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [
    { status: "ACTIVE" },
    { OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
  ];

  const categorySlugs = query.categorySlugs ?? (query.categorySlug ? [query.categorySlug] : []);
  if (categorySlugs.length > 0) {
    and.push({ category: { slug: { in: categorySlugs }, isActive: true } });
  }
  if (query.collectionSlug) {
    and.push({
      collectionLinks: { some: { collection: { slug: query.collectionSlug, isActive: true } } },
    });
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
  if (query.inStock) {
    and.push({ variants: { some: { isActive: true, inventory: { stock: { gt: 0 } } } } });
  }
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

export async function getStorefrontProducts(query: CatalogQuery): Promise<{
  items: StoreProductCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(48, query.pageSize ?? PAGE_SIZE);
  const where = buildWhere(query);

  try {
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
      items: rows.map(mapProductCard),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (error) {
    console.error("[catalog] list failed", error);
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }
}

export async function getProductBySlug(slug: string): Promise<StoreProduct | null> {
  const product = await prisma.product
    .findFirst({
      where: { slug, status: "ACTIVE" },
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
    })
    .catch((error) => {
      console.error("[catalog] product lookup failed", error);
      return null;
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
    defaultVariantId: variantList[0]?.id ?? null,
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

export async function getRelatedProducts(productId: string, categoryId: string | null, take = 8) {
  const rows = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      id: { not: productId },
      ...(categoryId ? { categoryId } : {}),
    },
    include: cardInclude,
    orderBy: [{ isBestseller: "desc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map(mapProductCard);
}

export async function getFeaturedProducts(take = 10) {
  try {
    const rows = await prisma.product.findMany({
      where: { status: "ACTIVE", OR: [{ isFeatured: true }, { isBestseller: true }] },
      include: cardInclude,
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map(mapProductCard);
  } catch (error) {
    console.error("[catalog] featured failed", error);
    return [];
  }
}

export async function getNewInProducts(take = 10) {
  try {
    const rows = await prisma.product.findMany({
      where: { status: "ACTIVE", isNew: true },
      include: cardInclude,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map(mapProductCard);
  } catch (error) {
    console.error("[catalog] new-in failed", error);
    return [];
  }
}

export async function getBestSellers(take = 10) {
  try {
    const rows = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: cardInclude,
      orderBy: [{ soldCount: "desc" }, { isBestseller: "desc" }],
      take,
    });
    return rows.map(mapProductCard);
  } catch (error) {
    console.error("[catalog] best sellers failed", error);
    return [];
  }
}

export async function getFilterFacets() {
  try {
    const [colors, sizes, priceRange] = await Promise.all([
      prisma.product.findMany({
        where: { status: "ACTIVE", color: { not: null } },
        select: { color: true },
        distinct: ["color"],
      }),
      prisma.product.findMany({
        where: { status: "ACTIVE", size: { not: null } },
        select: { size: true },
        distinct: ["size"],
      }),
      prisma.product.aggregate({
        where: { status: "ACTIVE" },
        _min: { price: true },
        _max: { price: true },
      }),
    ]);
    return {
      colors: colors.map((entry) => entry.color).filter((value): value is string => Boolean(value)),
      sizes: sizes.map((entry) => entry.size).filter((value): value is string => Boolean(value)),
      minPrice: priceRange._min.price ?? 0,
      maxPrice: priceRange._max.price ?? 0,
    };
  } catch {
    return { colors: [], sizes: [], minPrice: 0, maxPrice: 0 };
  }
}
