"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAG_CATALOG } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { toUserMessage } from "@/lib/errors";
import { requirePermission } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { setStock } from "@/server/inventory";
import { z } from "zod";
import { adminId, inventoryListParams } from "@/lib/validation/admin";
import type { Prisma } from "@prisma/client";

export async function listInventory(params: { search?: string; lowOnly?: boolean; page?: number }) {
  await requirePermission("inventory:read");
  const parsed = inventoryListParams.safeParse(params);
  if (!parsed.success) return { items: [], total: 0, page: 1, totalPages: 1 };
  const safeParams = parsed.data;
  const page = safeParams.page;
  const pageSize = 30;

  const conditions: Prisma.InventoryWhereInput[] = [];
  if (safeParams.search) {
    const term = safeParams.search;
    conditions.push({
      variant: {
        OR: [
          { sku: { contains: term, mode: "insensitive" } },
          { product: { name: { contains: term, mode: "insensitive" } } },
        ],
      },
    });
  }
  if (safeParams.lowOnly) {
    // Available stock (stock - reserved) cannot be expressed in a Prisma
    // where clause, so prefilter low IDs with SQL against per-row thresholds.
    const lowRows = await prisma.$queryRaw<Array<{ variantId: string }>>`
      SELECT "variantId" FROM "Inventory"
      WHERE stock - reserved <= "lowStockThreshold"
      LIMIT 5000
    `;
    const lowIds = lowRows.map((row) => row.variantId);
    if (lowIds.length === 0) return { items: [], total: 0, page, totalPages: 1 };
    conditions.push({ variantId: { in: lowIds } });
  }
  const where: Prisma.InventoryWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [items, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      orderBy: { stock: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            optionLabel: true,
            isActive: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
              },
            },
          },
        },
      },
    }),
    prisma.inventory.count({ where }),
  ]);

  return {
    items: items.map((row) => ({
      variantId: row.variantId,
      sku: row.variant.sku,
      stock: row.stock,
      reserved: row.reserved,
      available: row.stock - row.reserved,
      threshold: row.lowStockThreshold,
      productId: row.variant.product.id,
      productName: row.variant.product.name,
      productSlug: row.variant.product.slug,
      productImageUrl: row.variant.product.images[0]?.url ?? null,
      optionLabel: row.variant.optionLabel,
      isActive: row.variant.isActive,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const adjustSchema = z.object({
  variantId: adminId,
  stock: z.coerce.number().int().min(0),
  reason: z.string().trim().max(200).optional(),
});

export async function adjustStockAction(input: z.infer<typeof adjustSchema>) {
  const actor = await requirePermission("inventory:write");
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid stock value." };

  try {
    await prisma.$transaction(async (tx) => {
      await setStock(tx, {
        variantId: parsed.data.variantId,
        stock: parsed.data.stock,
        reason: parsed.data.reason || "Manual adjustment",
        userId: actor.id,
      });
    });
    await recordAudit({
      actorUserId: actor.id,
      action: "INVENTORY_ADJUSTED",
      resource: "Inventory",
      resourceId: parsed.data.variantId,
      metadata: { stock: parsed.data.stock, reason: parsed.data.reason },
    });
    revalidatePath("/admin/inventory");
    revalidateTag(CACHE_TAG_CATALOG);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function listInventoryTransactions(variantId: string) {
  await requirePermission("inventory:read");
  const parsedId = adminId.safeParse(variantId);
  if (!parsedId.success) return [];
  return prisma.inventoryTransaction.findMany({
    where: { variantId: parsedId.data },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true } } },
  });
}
