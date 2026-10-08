"use server";

import { revalidatePath } from "next/cache";
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

  const where: Prisma.InventoryWhereInput = {};
  if (safeParams.search) {
    const term = safeParams.search;
    where.variant = {
      OR: [
        { sku: { contains: term, mode: "insensitive" } },
        { product: { name: { contains: term, mode: "insensitive" } } },
      ],
    };
  }
  if (safeParams.lowOnly) {
    where.stock = { lte: 5 };
  }

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
  variantId: z.string().min(1),
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
