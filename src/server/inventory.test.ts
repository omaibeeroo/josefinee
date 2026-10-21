import { describe, expect, it, vi } from "vitest";
import {
  captureReservedStock,
  decrementStock,
  releaseReservedStock,
  reserveStock,
} from "@/server/inventory";

describe("inventory checkout integrity", () => {
  it("allows only one simultaneous purchaser of the final available unit", async () => {
    let queryCalls = 0;
    let releaseBoth: (() => void) | undefined;
    const bothArrived = new Promise<void>((resolve) => {
      releaseBoth = resolve;
    });
    const queryRaw = vi.fn(async () => {
      queryCalls += 1;
      const callNumber = queryCalls;
      if (queryCalls === 2) releaseBoth?.();
      await bothArrived;
      return callNumber === 1 ? [{ stock: 0 }] : [];
    });
    const txMock = {
      inventory: { findUnique: vi.fn().mockResolvedValue({ id: "inventory-1" }) },
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: queryRaw,
      inventoryTransaction: { create: vi.fn().mockResolvedValue({}) },
    };
    const tx = txMock as never;

    const results = await Promise.allSettled([
      decrementStock(tx, { variantId: "variant-1", quantity: 1, orderId: "order-1" }),
      decrementStock(tx, { variantId: "variant-1", quantity: 1, orderId: "order-2" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ status: "rejected", reason: { code: "OUT_OF_STOCK" } });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(txMock.inventoryTransaction.create).toHaveBeenCalledTimes(1);
  });

  it("does not write a sale transaction when the authoritative stock update fails", async () => {
    const transactionCreate = vi.fn();
    const tx = {
      inventory: { findUnique: vi.fn().mockResolvedValue({ id: "inventory-1" }) },
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockRejectedValue(new Error("database unavailable")),
      inventoryTransaction: { create: transactionCreate },
    } as never;

    await expect(
      decrementStock(tx, { variantId: "variant-1", quantity: 1, orderId: "order-1" }),
    ).rejects.toThrow("database unavailable");
    expect(transactionCreate).not.toHaveBeenCalled();
  });

  it("serializes reservation lifecycle mutations and never permits negative reserved stock", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ stock: 5, reserved: 2 }])
      .mockResolvedValueOnce([{ stock: 5, reserved: 0 }])
      .mockResolvedValueOnce([{ stock: 3, reserved: 0 }])
      .mockResolvedValueOnce([]);
    const tx = {
      inventory: { findUnique: vi.fn().mockResolvedValue({ id: "inventory-1" }) },
      $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: queryRaw,
      inventoryTransaction: { create: vi.fn().mockResolvedValue({}) },
    } as never;

    await reserveStock(tx, { variantId: "variant-1", quantity: 2 });
    await releaseReservedStock(tx, { variantId: "variant-1", quantity: 2 });
    await captureReservedStock(tx, { variantId: "variant-1", quantity: 1 }).catch((error) => {
      expect(error).toMatchObject({ code: "INVALID_QUANTITY" });
    });
    await releaseReservedStock(tx, { variantId: "variant-1", quantity: 1 }).catch((error) => {
      expect(error).toMatchObject({ code: "INVALID_QUANTITY" });
    });

    expect((tx as { $executeRaw: ReturnType<typeof vi.fn> }).$executeRaw).toHaveBeenCalledTimes(4);
    expect(queryRaw).toHaveBeenCalledTimes(4);
    expect(
      (tx as { inventoryTransaction: { create: ReturnType<typeof vi.fn> } }).inventoryTransaction
        .create,
    ).toHaveBeenCalledTimes(3);
  });
});
