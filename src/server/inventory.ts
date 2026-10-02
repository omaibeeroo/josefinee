import "server-only";
import { AppError } from "@/lib/errors";
import type { InventoryTxnType, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export function computeAvailable(stock: number, reserved: number): number {
  return Math.max(0, stock - reserved);
}

/**
 * Atomically decrements stock. Uses a conditional update so two concurrent
 * checkouts can never drive stock negative — the second update simply matches
 * zero rows and fails with OUT_OF_STOCK.
 */
export async function decrementStock(
  tx: Tx,
  input: { variantId: string; quantity: number; orderId?: string; reason?: string },
): Promise<void> {
  if (input.quantity <= 0) throw new AppError("INVALID_QUANTITY", "Invalid quantity.");

  const inventory = await tx.inventory.findUnique({ where: { variantId: input.variantId } });
  if (!inventory) {
    throw new AppError("OUT_OF_STOCK", "Sorry, this item is no longer available.", 409);
  }

  const updated = await tx.inventory.updateMany({
    where: { id: inventory.id, stock: { gte: input.quantity } },
    data: { stock: { decrement: input.quantity } },
  });

  if (updated.count === 0) {
    throw new AppError("OUT_OF_STOCK", "Sorry, one of the items in your bag just sold out.", 409, {
      variantId: input.variantId,
    });
  }

  await tx.inventoryTransaction.create({
    data: {
      inventoryId: inventory.id,
      variantId: input.variantId,
      type: "SALE",
      quantity: -input.quantity,
      stockAfter: inventory.stock - input.quantity,
      orderId: input.orderId,
      reason: input.reason,
    },
  });
}

export async function incrementStock(
  tx: Tx,
  input: {
    variantId: string;
    quantity: number;
    type: InventoryTxnType;
    orderId?: string;
    reason?: string;
    userId?: string;
  },
): Promise<void> {
  if (input.quantity <= 0) throw new AppError("INVALID_QUANTITY", "Invalid quantity.");

  const inventory = await tx.inventory.upsert({
    where: { variantId: input.variantId },
    create: { variantId: input.variantId, stock: input.quantity },
    update: { stock: { increment: input.quantity } },
  });

  await tx.inventoryTransaction.create({
    data: {
      inventoryId: inventory.id,
      variantId: input.variantId,
      type: input.type,
      quantity: input.quantity,
      stockAfter: inventory.stock,
      orderId: input.orderId,
      reason: input.reason,
      userId: input.userId,
    },
  });
}

export async function setStock(
  tx: Tx,
  input: { variantId: string; stock: number; reason?: string; userId?: string },
): Promise<void> {
  if (input.stock < 0) throw new AppError("INVALID_QUANTITY", "Stock cannot be negative.");

  const existing = await tx.inventory.findUnique({ where: { variantId: input.variantId } });
  if (existing && input.stock < existing.reserved) {
    throw new AppError("INVALID_QUANTITY", "Stock cannot be lower than reserved inventory.");
  }
  const delta = input.stock - (existing?.stock ?? 0);

  const inventory = await tx.inventory.upsert({
    where: { variantId: input.variantId },
    create: { variantId: input.variantId, stock: input.stock },
    update: { stock: input.stock },
  });

  await tx.inventoryTransaction.create({
    data: {
      inventoryId: inventory.id,
      variantId: input.variantId,
      type: "MANUAL_ADJUSTMENT",
      quantity: delta,
      stockAfter: input.stock,
      reason: input.reason ?? "Manual adjustment",
      userId: input.userId,
    },
  });
}
