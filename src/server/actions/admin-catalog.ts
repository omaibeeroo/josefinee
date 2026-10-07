"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AppError, toUserMessage } from "@/lib/errors";
import { requirePermission } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { cleanRichText } from "@/lib/sanitize";
import { setStock } from "@/server/inventory";
import { flattenZodErrors } from "@/lib/validation/common";
import { adminId, productListParams, productStatus, reviewStatus } from "@/lib/validation/admin";
import {
  categorySchema,
  collectionSchema,
  productSchema,
  type ProductInput,
} from "@/lib/validation/product";
import { randomSuffix, slugify } from "@/lib/slug";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

/* --------------------------------------------------------------- Products */

export async function listAdminProducts(params: {
  search?: string;
  status?: string;
  page?: number;
}) {
  await requirePermission("products:read");
  const parsed = productListParams.safeParse(params);
  if (!parsed.success) return { items: [], total: 0, page: 1, totalPages: 1 };
  const safeParams = parsed.data;
  const page = safeParams.page;
  const pageSize = 20;

  const where: Prisma.ProductWhereInput = {};
  if (safeParams.status) where.status = safeParams.status;
  if (safeParams.search) {
    const term = safeParams.search;
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        status: true,
        soldCount: true,
        updatedAt: true,
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
        variants: { select: { id: true, inventory: { select: { stock: true, reserved: true } } } },
        category: { select: { name: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map((product) => ({
      ...product,
      stock: product.variants.reduce(
        (sum, variant) =>
          sum + (variant.inventory?.stock ?? 0) - (variant.inventory?.reserved ?? 0),
        0,
      ),
      variantCount: product.variants.length,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProductForEdit(id: string) {
  await requirePermission("products:read");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) throw new AppError("INVALID_INPUT", "Invalid product ID.", 400);
  const product = await prisma.product.findUnique({
    where: { id: parsedId.data },
    include: {
      images: { orderBy: [{ sortOrder: "asc" }] },
      options: {
        orderBy: { position: "asc" },
        include: { values: { orderBy: { position: "asc" } } },
      },
      variants: {
        orderBy: { position: "asc" },
        include: {
          inventory: true,
          optionValues: { include: { optionValue: { include: { option: true } } } },
        },
      },
    },
  });
  if (!product) throw new AppError("NOT_FOUND", "Product not found.", 404);

  return {
    ...product,
    options: product.options.map((option) => ({
      id: option.id,
      name: option.name,
      position: option.position,
      values: option.values.map((value) => ({
        id: value.id,
        value: value.value,
        hexColor: value.hexColor,
        position: value.position,
      })),
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      barcode: variant.barcode,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      imageUrl: variant.imageUrl,
      selections: variant.optionValues.map((entry) => ({
        option: entry.optionValue.option.name,
        value: entry.optionValue.value,
      })),
      stock: variant.inventory?.stock ?? 0,
      lowStockThreshold: variant.inventory?.lowStockThreshold ?? 3,
      isActive: variant.isActive,
    })),
  };
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
  const normalized = slugify(base) || `product-${randomSuffix()}`;
  const existing = await prisma.product.findMany({
    where: { slug: { startsWith: normalized }, id: excludeId ? { not: excludeId } : undefined },
    select: { slug: true },
  });
  const taken = new Set(existing.map((entry) => entry.slug));
  if (!taken.has(normalized)) return normalized;
  let candidate = `${normalized}-${randomSuffix()}`;
  while (taken.has(candidate)) candidate = `${normalized}-${randomSuffix()}`;
  return candidate;
}

export async function saveProductAction(input: ProductInput) {
  const actor = await requirePermission("products:write");
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please review the product fields.",
      fields: flattenZodErrors(parsed.error),
    };
  }
  const data = parsed.data;
  const slug = await ensureUniqueSlug(data.slug || data.name, data.id);

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return { ok: false as const, error: "Selected category does not exist." };
  }

  // SKU uniqueness across all variants (excluding this product's own variants).
  const skus = data.variants.map((variant) => variant.sku.trim());
  if (new Set(skus.map((sku) => sku.toLowerCase())).size !== skus.length) {
    return { ok: false as const, error: "Variant SKUs must be unique within the product." };
  }
  const conflicting = await prisma.productVariant.findMany({
    where: {
      sku: { in: skus },
      ...(data.id ? { productId: { not: data.id } } : {}),
    },
    select: { sku: true },
  });
  if (conflicting.length > 0) {
    return { ok: false as const, error: `SKU already in use: ${conflicting[0]?.sku}.` };
  }

  const description = cleanRichText(data.description);

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const previous = data.id
        ? await tx.product.findUnique({
            where: { id: data.id },
            select: { status: true, publishedAt: true },
          })
        : null;
      // Preserve the original publication date — only stamp it when a
      // product becomes ACTIVE for the first time.
      const publishedAt =
        data.status === "ACTIVE" && previous?.status !== "ACTIVE"
          ? (data.publishedAt ?? new Date())
          : (data.publishedAt ?? previous?.publishedAt ?? null);

      const product = data.id
        ? await tx.product.update({
            where: { id: data.id },
            data: {
              name: data.name,
              slug,
              sku: data.sku || null,
              barcode: data.barcode || null,
              shortDescription: data.shortDescription || null,
              description,
              price: data.price,
              compareAtPrice: data.compareAtPrice ?? null,
              costPrice: data.costPrice ?? null,
              categoryId: data.categoryId || null,
              tags: data.tags.map((tag) => tag.toLowerCase()),
              status: data.status,
              isFeatured: data.isFeatured,
              isBestseller: data.isBestseller,
              isNew: data.isNew,
              sortOrder: data.sortOrder,
              publishedAt,
              material: data.material || null,
              color: data.color || null,
              size: data.size || null,
              weight: data.weight ?? null,
              dimensions: data.dimensions || null,
              careInstructions: data.careInstructions || null,
              shippingInfo: data.shippingInfo || null,
              seoTitle: data.seoTitle || null,
              seoDescription: data.seoDescription || null,
              seoImage: data.seoImage || null,
            },
          })
        : await tx.product.create({
            data: {
              name: data.name,
              slug,
              sku: data.sku || null,
              barcode: data.barcode || null,
              shortDescription: data.shortDescription || null,
              description,
              price: data.price,
              compareAtPrice: data.compareAtPrice ?? null,
              costPrice: data.costPrice ?? null,
              categoryId: data.categoryId || null,
              tags: data.tags.map((tag) => tag.toLowerCase()),
              status: data.status,
              isFeatured: data.isFeatured,
              isBestseller: data.isBestseller,
              isNew: data.isNew,
              sortOrder: data.sortOrder,
              publishedAt,
              material: data.material || null,
              color: data.color || null,
              size: data.size || null,
              weight: data.weight ?? null,
              dimensions: data.dimensions || null,
              careInstructions: data.careInstructions || null,
              shippingInfo: data.shippingInfo || null,
              seoTitle: data.seoTitle || null,
              seoDescription: data.seoDescription || null,
              seoImage: data.seoImage || null,
            },
          });

      // --- Options & values (upsert by name; remove deleted) ---
      const wantedOptions = data.options.map((option) => option.name.trim());
      const existingOptions = await tx.productOption.findMany({
        where: { productId: product.id },
        include: { values: true },
      });
      for (const existing of existingOptions) {
        if (!wantedOptions.includes(existing.name)) {
          await tx.productOption.delete({ where: { id: existing.id } });
        }
      }
      const optionIdByName = new Map<string, string>();
      for (const [position, option] of data.options.entries()) {
        const name = option.name.trim();
        const savedOption = await tx.productOption.upsert({
          where: { productId_name: { productId: product.id, name } },
          create: { productId: product.id, name, position },
          update: { position },
        });
        optionIdByName.set(name, savedOption.id);
        const wantedValues = option.values.map((value) => value.value.trim());
        await tx.productOptionValue.deleteMany({
          where: { optionId: savedOption.id, value: { notIn: wantedValues } },
        });
        for (const [valuePosition, value] of option.values.entries()) {
          await tx.productOptionValue.upsert({
            where: { optionId_value: { optionId: savedOption.id, value: value.value.trim() } },
            create: {
              optionId: savedOption.id,
              value: value.value.trim(),
              hexColor: value.hexColor || null,
              position: valuePosition,
            },
            update: { hexColor: value.hexColor || null, position: valuePosition },
          });
        }
      }

      const valueIdByKey = new Map<string, string>();
      const allValues = await tx.productOptionValue.findMany({
        where: { option: { productId: product.id } },
        include: { option: true },
      });
      for (const value of allValues) {
        valueIdByKey.set(`${value.option.name}::${value.value}`, value.id);
      }

      // --- Variants (upsert; drop only variants with no history) ---
      const inputVariantIds = new Set(
        data.variants.map((variant) => variant.id).filter(Boolean) as string[],
      );
      const existingVariants = await tx.productVariant.findMany({
        where: { productId: product.id },
        include: { _count: { select: { orderItems: true } }, inventory: { select: { id: true } } },
      });
      const existingVariantIds = new Set(existingVariants.map((variant) => variant.id));
      const foreignVariant = [...inputVariantIds].find((id) => !existingVariantIds.has(id));
      if (foreignVariant)
        throw new AppError("VALIDATION", "Variant does not belong to this product.", 400);
      for (const existing of existingVariants) {
        if (!inputVariantIds.has(existing.id)) {
          const historyCount = existing._count.orderItems;
          const txns = existing.inventory
            ? await tx.inventoryTransaction.count({ where: { inventoryId: existing.inventory.id } })
            : 0;
          if (historyCount === 0 && txns === 0) {
            await tx.productVariant.delete({ where: { id: existing.id } });
          } else {
            await tx.productVariant.update({
              where: { id: existing.id },
              data: { isActive: false },
            });
          }
        }
      }

      for (const [position, variant] of data.variants.entries()) {
        const optionLabel =
          variant.selections.length > 0
            ? variant.selections.map((selection) => selection.value).join(" / ")
            : null;

        const savedVariant = variant.id
          ? await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                sku: variant.sku.trim(),
                barcode: variant.barcode || null,
                price: variant.price ?? null,
                compareAtPrice: variant.compareAtPrice ?? null,
                imageUrl: variant.imageUrl || null,
                optionLabel,
                position,
                isActive: variant.isActive,
              },
            })
          : await tx.productVariant.create({
              data: {
                productId: product.id,
                sku: variant.sku.trim(),
                barcode: variant.barcode || null,
                price: variant.price ?? null,
                compareAtPrice: variant.compareAtPrice ?? null,
                imageUrl: variant.imageUrl || null,
                optionLabel,
                position,
                isActive: variant.isActive,
              },
            });

        await tx.variantOptionValue.deleteMany({ where: { variantId: savedVariant.id } });
        for (const selection of variant.selections) {
          const valueId = valueIdByKey.get(`${selection.option}::${selection.value}`);
          if (valueId) {
            await tx.variantOptionValue.create({
              data: { variantId: savedVariant.id, optionValueId: valueId },
            });
          }
        }

        const inventory = await tx.inventory.findUnique({ where: { variantId: savedVariant.id } });
        if (!inventory) {
          const created = await tx.inventory.create({
            data: {
              variantId: savedVariant.id,
              stock: variant.stock,
              lowStockThreshold: variant.lowStockThreshold,
            },
          });
          await tx.inventoryTransaction.create({
            data: {
              inventoryId: created.id,
              variantId: savedVariant.id,
              type: "PURCHASE",
              quantity: variant.stock,
              stockAfter: variant.stock,
              reason: "Initial stock",
              userId: actor.id,
            },
          });
        } else if (inventory.stock !== variant.stock) {
          await setStock(tx, {
            variantId: savedVariant.id,
            stock: variant.stock,
            reason: "Product editor",
            userId: actor.id,
          });
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { lowStockThreshold: variant.lowStockThreshold },
          });
        } else {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { lowStockThreshold: variant.lowStockThreshold },
          });
        }
      }

      // --- Images (authoritative list from the editor) ---
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      for (const [index, image] of data.images.entries()) {
        await tx.productImage.create({
          data: {
            productId: product.id,
            url: image.url,
            storageKey: image.storageKey || null,
            alt: image.alt || product.name,
            width: image.width ?? null,
            height: image.height ?? null,
            sortOrder: index,
            isPrimary: index === 0,
          },
        });
      }

      return product;
    });

    await recordAudit({
      actorUserId: actor.id,
      action: data.id ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
      resource: "Product",
      resourceId: saved.id,
      metadata: { slug: saved.slug },
    });

    revalidatePath("/admin/products");
    revalidatePath(`/products/${saved.slug}`);
    revalidatePath("/shop");
    return { ok: true as const, id: saved.id, slug: saved.slug };
  } catch (error) {
    console.error("[admin] save product failed", error instanceof Error ? error.name : "unknown");
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function archiveProductAction(id: string) {
  const actor = await requirePermission("products:delete");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) return { ok: false as const, error: "Invalid product ID." };
  const orderItems = await prisma.orderItem.count({ where: { productId: parsedId.data } });
  if (orderItems > 0) {
    await prisma.product.update({
      where: { id: parsedId.data },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
  } else {
    await prisma.product.delete({ where: { id: parsedId.data } });
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "PRODUCT_DELETED",
    resource: "Product",
    resourceId: id,
  });
  revalidatePath("/admin/products");
  return { ok: true as const };
}

export async function setProductStatusAction(id: string, status: "DRAFT" | "ACTIVE" | "ARCHIVED") {
  const actor = await requirePermission("products:write");
  const parsedId = adminId.safeParse(id);
  const parsedStatus = productStatus.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { ok: false as const, error: "Invalid product status update." };
  }
  const current = await prisma.product.findUnique({ where: { id: parsedId.data }, select: { status: true } });
  if (!current) return { ok: false as const, error: "Product not found." };
  await prisma.product.update({
    where: { id: parsedId.data },
    data: {
      status: parsedStatus.data,
      archivedAt: parsedStatus.data === "ARCHIVED" ? new Date() : null,
      publishedAt: parsedStatus.data === "ACTIVE" && current.status !== "ACTIVE" ? new Date() : undefined,
    },
  });
  await recordAudit({
    actorUserId: actor.id,
    action: "PRODUCT_STATUS_CHANGED",
    resource: "Product",
    resourceId: id,
    metadata: { status },
  });
  revalidatePath("/admin/products");
  return { ok: true as const };
}

/* ------------------------------------------------------------- Categories */

export async function listCategoriesAdmin() {
  await requirePermission("products:read");
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { name: true } },
      _count: { select: { products: true, children: true } },
    },
  });
}

export async function saveCategoryAction(input: unknown) {
  const actor = await requirePermission("catalog:write");
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please review the category fields.",
      fields: flattenZodErrors(parsed.error),
    };
  }
  const data = parsed.data;
  const slug = data.slug || slugify(data.name);
  const clash = await prisma.category.findFirst({
    where: { slug, id: data.id ? { not: data.id } : undefined },
  });
  if (clash) return { ok: false as const, error: "Another category already uses this slug." };
  if (data.parentId && data.parentId === data.id) {
    return { ok: false as const, error: "A category cannot be its own parent." };
  }

  const saved = data.id
    ? await prisma.category.update({
        where: { id: data.id },
        data: {
          name: data.name,
          slug,
          description: data.description || null,
          image: data.image || null,
          parentId: data.parentId || null,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
        },
      })
    : await prisma.category.create({
        data: {
          name: data.name,
          slug,
          description: data.description || null,
          image: data.image || null,
          parentId: data.parentId || null,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
        },
      });

  await recordAudit({
    actorUserId: actor.id,
    action: data.id ? "CATEGORY_UPDATED" : "CATEGORY_CREATED",
    resource: "Category",
    resourceId: saved.id,
  });
  revalidatePath("/admin/categories");
  return { ok: true as const, id: saved.id };
}

export async function deleteCategoryAction(id: string) {
  const actor = await requirePermission("catalog:write");
  const [products, children] = await Promise.all([
    prisma.product.count({ where: { categoryId: id } }),
    prisma.category.count({ where: { parentId: id } }),
  ]);
  if (products > 0 || children > 0) {
    return {
      ok: false as const,
      error: "This category still has products or subcategories. Move them first.",
    };
  }
  await prisma.category.delete({ where: { id } });
  await recordAudit({
    actorUserId: actor.id,
    action: "CATEGORY_DELETED",
    resource: "Category",
    resourceId: id,
  });
  revalidatePath("/admin/categories");
  return { ok: true as const };
}

export async function saveCollectionAction(input: unknown) {
  const actor = await requirePermission("catalog:write");
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please review the collection fields.",
      fields: flattenZodErrors(parsed.error),
    };
  }
  const data = parsed.data;
  const slug = data.slug || slugify(data.name);
  const clash = await prisma.collection.findFirst({
    where: { slug, id: data.id ? { not: data.id } : undefined },
  });
  if (clash) return { ok: false as const, error: "Another collection already uses this slug." };

  const saved = await prisma.$transaction(async (tx) => {
    const collection = data.id
      ? await tx.collection.update({
          where: { id: data.id },
          data: {
            name: data.name,
            slug,
            description: data.description || null,
            image: data.image || null,
            type: data.type,
            sortOrder: data.sortOrder,
            isActive: data.isActive,
            isFeatured: data.isFeatured,
            showInNav: data.showInNav,
            seoTitle: data.seoTitle || null,
            seoDescription: data.seoDescription || null,
          },
        })
      : await tx.collection.create({
          data: {
            name: data.name,
            slug,
            description: data.description || null,
            image: data.image || null,
            type: data.type,
            sortOrder: data.sortOrder,
            isActive: data.isActive,
            isFeatured: data.isFeatured,
            showInNav: data.showInNav,
            seoTitle: data.seoTitle || null,
            seoDescription: data.seoDescription || null,
          },
        });

    if (data.type === "MANUAL") {
      await tx.collectionProduct.deleteMany({ where: { collectionId: collection.id } });
      if (data.productIds.length > 0) {
        await tx.collectionProduct.createMany({
          data: data.productIds.map((productId, index) => ({
            collectionId: collection.id,
            productId,
            sortOrder: index,
          })),
          skipDuplicates: true,
        });
      }
    }
    return collection;
  });

  await recordAudit({
    actorUserId: actor.id,
    action: data.id ? "COLLECTION_UPDATED" : "COLLECTION_CREATED",
    resource: "Collection",
    resourceId: saved.id,
  });
  revalidatePath("/admin/collections");
  revalidatePath(`/collections/${saved.slug}`);
  return { ok: true as const, id: saved.id };
}

export async function deleteCollectionAction(id: string) {
  const actor = await requirePermission("catalog:write");
  await prisma.collection.delete({ where: { id } });
  await recordAudit({
    actorUserId: actor.id,
    action: "COLLECTION_DELETED",
    resource: "Collection",
    resourceId: id,
  });
  revalidatePath("/admin/collections");
  return { ok: true as const };
}

/* ---------------------------------------------------------------- Reviews */

export async function listReviewsAdmin(status?: string) {
  await requirePermission("reviews:moderate");
  const parsedStatus = status ? z.enum(["PENDING", "APPROVED", "REJECTED"]).safeParse(status) : null;
  if (parsedStatus && !parsedStatus.success) return [];
  return prisma.review.findMany({
    where: parsedStatus?.success ? { status: parsedStatus.data } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { name: true, slug: true } } },
  });
}

async function recomputeRating(productId: string) {
  const approved = await prisma.review.findMany({
    where: { productId, status: "APPROVED" },
    select: { rating: true },
  });
  const count = approved.length;
  const average = count > 0 ? approved.reduce((sum, review) => sum + review.rating, 0) / count : 0;
  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: Math.round(average * 10) / 10, ratingCount: count },
  });
}

export async function moderateReviewAction(id: string, status: "APPROVED" | "REJECTED") {
  const actor = await requirePermission("reviews:moderate");
  const parsedId = adminId.safeParse(id);
  const parsedStatus = reviewStatus.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { ok: false as const, error: "Invalid review moderation request." };
  }
  const review = await prisma.review.update({ where: { id: parsedId.data }, data: { status: parsedStatus.data } });
  await recomputeRating(review.productId);
  await recordAudit({
    actorUserId: actor.id,
    action: "REVIEW_MODERATED",
    resource: "Review",
    resourceId: id,
    metadata: { status },
  });
  revalidatePath("/admin/reviews");
  revalidatePath(`/products/${review.productId}`);
  return { ok: true as const };
}

export async function deleteReviewAction(id: string) {
  const actor = await requirePermission("reviews:moderate");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) return { ok: false as const, error: "Invalid review ID." };
  const review = await prisma.review.findUnique({ where: { id: parsedId.data } });
  if (!review) return { ok: false as const, error: "Review not found." };
  await prisma.review.delete({ where: { id: parsedId.data } });
  await recomputeRating(review.productId);
  await recordAudit({
    actorUserId: actor.id,
    action: "REVIEW_DELETED",
    resource: "Review",
    resourceId: id,
  });
  revalidatePath("/admin/reviews");
  return { ok: true as const };
}
