import { z } from "zod";
import { zId, zOptionalString, zPrice, zSlug } from "./common";

export const productOptionValueSchema = z.object({
  id: zId.optional(),
  value: z.string().trim().min(1).max(60),
  hexColor: z.string().trim().max(9).optional(),
  position: z.coerce.number().int().min(0).default(0),
});

export const productOptionSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(1).max(60),
  position: z.coerce.number().int().min(0).default(0),
  values: z.array(productOptionValueSchema).min(1),
});

export const variantSchema = z.object({
  id: zId.optional(),
  sku: z.string().trim().min(1).max(80),
  barcode: zOptionalString(80),
  price: zPrice.nullable().optional(),
  compareAtPrice: zPrice.nullable().optional(),
  imageUrl: zOptionalString(1000),
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
  isActive: z.coerce.boolean().default(true),
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
  isFeatured: z.coerce.boolean().default(false),
  isBestseller: z.coerce.boolean().default(false),
  isNew: z.coerce.boolean().default(false),
  soldCount: z.coerce.number().int().min(0).default(0),
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
  seoImage: zOptionalString(1000),
  options: z.array(productOptionSchema).max(4).default([]),
  variants: z.array(variantSchema).max(100).default([]),
  images: z
    .array(
      z.object({
        id: zId.optional(),
        url: z.string().trim().url().max(1000),
        storageKey: zOptionalString(500),
        alt: zOptionalString(200),
        width: z.coerce.number().int().optional(),
        height: z.coerce.number().int().optional(),
        sortOrder: z.coerce.number().int().min(0).default(0),
        isPrimary: z.coerce.boolean().default(false),
      }),
    )
    .max(20)
    .default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(1).max(120),
  slug: zSlug.optional(),
  description: zOptionalString(1000),
  image: zOptionalString(1000),
  parentId: zId.optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
  seoTitle: zOptionalString(160),
  seoDescription: zOptionalString(320),
});

export const collectionSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(1).max(120),
  slug: zSlug.optional(),
  description: zOptionalString(2000),
  image: zOptionalString(1000),
  type: z.enum(["MANUAL", "NEW_IN", "BEST_SELLERS", "SALE"]).default("MANUAL"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
  isFeatured: z.coerce.boolean().default(false),
  showInNav: z.coerce.boolean().default(true),
  seoTitle: zOptionalString(160),
  seoDescription: zOptionalString(320),
  productIds: z.array(zId).max(500).default([]),
});
