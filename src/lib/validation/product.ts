import { z } from "zod";
import { zId, zOptionalString, zPrice, zSlug, zStrictBoolean } from "./common";

/**
 * Product image locations: absolute http(s) URLs (S3/R2/CDN) or app-relative
 * paths produced by our own upload endpoint (local driver → `/uploads/...`).
 * Relative URLs render fine in <img>; JSON-LD absolutizes them at render time.
 */
export const productImageUrl = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine(
    (value) =>
      /^https?:\/\/[^/\s]+\/\S*$/i.test(value) ||
      (value.length > 1 && value.startsWith("/") && !value.startsWith("//")),
    "Image URL must be an absolute http(s) URL or an app-relative path.",
  );

/** Optional image field: "" and absent both mean "no image", otherwise allowlisted. */
export const optionalImageUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  productImageUrl.optional(),
);

const productOptionValueSchema = z.object({
  id: zId.optional(),
  value: z.string().trim().min(1).max(60),
  hexColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, "Use a hex color like #b08d57.")
    .optional(),
  position: z.coerce.number().int().min(0).default(0),
});

const productOptionSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(1).max(60),
  position: z.coerce.number().int().min(0).default(0),
  values: z.array(productOptionValueSchema).min(1),
});

const variantSchema = z.object({
  id: zId.optional(),
  sku: z.string().trim().min(1).max(80),
  barcode: zOptionalString(80),
  price: zPrice.nullable().optional(),
  compareAtPrice: zPrice.nullable().optional(),
  imageUrl: optionalImageUrl,
  /** Name-based selections (e.g. [{option:"Finish", value:"Gold"}]) — resolved to IDs server-side. */
  selections: z
    .array(
      z.object({
        option: z.string().trim().min(1).max(60),
        value: z.string().trim().min(1).max(60),
      }),
    )
    .max(4)
    .default([]),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(3),
  isActive: zStrictBoolean.default(true),
});

export const productSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(2, "Product name is required.").max(160),
  slug: zSlug.optional(),
  sku: zOptionalString(80),
  barcode: zOptionalString(80),
  shortDescription: zOptionalString(300),
  description: z.string().trim().max(60_000).default(""),
  price: zPrice,
  compareAtPrice: zPrice.nullable().optional(),
  costPrice: zPrice.nullable().optional(),
  categoryId: zId.optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isFeatured: zStrictBoolean.default(false),
  isBestseller: zStrictBoolean.default(false),
  isNew: zStrictBoolean.default(false),
  // soldCount is derived from orders server-side and never accepted from input.
  publishedAt: z.coerce.date().nullable().optional(),
  material: zOptionalString(200),
  color: zOptionalString(80),
  size: zOptionalString(80),
  weight: z.coerce.number().int().min(0).nullable().optional(),
  dimensions: zOptionalString(120),
  careInstructions: zOptionalString(2000),
  shippingInfo: zOptionalString(2000),
  seoTitle: zOptionalString(160),
  seoDescription: zOptionalString(320),
  seoImage: optionalImageUrl,
  options: z.array(productOptionSchema).max(4).default([]),
  variants: z.array(variantSchema).max(100).default([]),
  images: z
    .array(
      z.object({
        id: zId.optional(),
        url: productImageUrl,
        storageKey: zOptionalString(500),
        alt: zOptionalString(200),
        width: z.coerce.number().int().min(1).max(10000).optional(),
        height: z.coerce.number().int().min(1).max(10000).optional(),
        sortOrder: z.coerce.number().int().min(0).default(0),
        isPrimary: zStrictBoolean.default(false),
      }),
    )
    .max(20)
    .default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z
  .object({
    id: zId.optional(),
    name: z.string().trim().min(1).max(120),
    slug: zSlug.optional(),
    description: zOptionalString(1000),
    image: optionalImageUrl,
    parentId: zId.optional(),
    sortOrder: z.coerce.number().int().min(0).default(0),
    isActive: zStrictBoolean.default(true),
    seoTitle: zOptionalString(160),
    seoDescription: zOptionalString(320),
  })
  .refine((data) => data.id === undefined || data.parentId !== data.id, {
    message: "A category cannot be its own parent.",
    path: ["parentId"],
  });

export const collectionSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(1).max(120),
  slug: zSlug.optional(),
  description: zOptionalString(2000),
  image: optionalImageUrl,
  type: z.enum(["MANUAL", "NEW_IN", "BEST_SELLERS", "SALE"]).default("MANUAL"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: zStrictBoolean.default(true),
  isFeatured: zStrictBoolean.default(false),
  showInNav: zStrictBoolean.default(true),
  seoTitle: zOptionalString(160),
  seoDescription: zOptionalString(320),
  productIds: z.array(zId).max(500).default([]),
});
