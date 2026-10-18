import { beforeEach, describe, expect, it, vi } from "vitest";
import { recoverSettledCheckout, type CreateOrderResult } from "@/server/orders";

process.env.AUTH_SECRET ??= "test-secret-that-is-long-enough-0123456789";

type RecoveryStore = Parameters<typeof recoverSettledCheckout>[1];

function makeStore() {
  return {
    idempotencyKey: { findUnique: vi.fn() },
    order: { findUnique: vi.fn() },
  } as unknown as RecoveryStore & {
    idempotencyKey: { findUnique: ReturnType<typeof vi.fn> };
    order: { findUnique: ReturnType<typeof vi.fn> };
  };
}

const settledResponse: Partial<CreateOrderResult> = {
  orderId: "ord_1",
  orderNumber: "HS-1001",
  total: 5400,
};

describe("recoverSettledCheckout (idempotency-loser recovery)", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("retries past a transient aborted-transaction read and replays the winner", async () => {
    const store = makeStore();
    store.idempotencyKey.findUnique
      .mockRejectedValueOnce(new Error("25P02: current transaction is aborted"))
      .mockResolvedValueOnce({ response: settledResponse });

    const result = await recoverSettledCheckout("key-1", store);

    expect(result).not.toBeNull();
    expect(result?.orderNumber).toBe("HS-1001");
    expect(result?.isDuplicate).toBe(true);
    expect(typeof result?.trackingToken).toBe("string");
    expect(store.idempotencyKey.findUnique).toHaveBeenCalledTimes(2);
  });

  it("recovers from the committed order row when the stored response is missing", async () => {
    const store = makeStore();
    store.idempotencyKey.findUnique.mockResolvedValue({ response: null });
    store.order.findUnique.mockResolvedValue({
      id: "ord_2",
      orderNumber: "HS-1002",
      total: 7200,
      subtotal: 7000,
      discount: 0,
      promotionDiscount: 0,
      promotion: null,
      shipping: 200,
      firstName: "Amina",
      phone: "0550000000",
      wilayaName: "Alger",
      communeName: "Bab El Oued",
      address: "Rue 1",
      deliveryMethod: "HOME",
    });

    const result = await recoverSettledCheckout("key-2", store);

    expect(result?.orderId).toBe("ord_2");
    expect(result?.isDuplicate).toBe(true);
  }, 10_000);

  it("returns null while the winner never settles (CHECKOUT_IN_PROGRESS path)", async () => {
    const store = makeStore();
    store.idempotencyKey.findUnique.mockResolvedValue({ response: null });
    store.order.findUnique.mockResolvedValue(null);

    const result = await recoverSettledCheckout("key-3", store);

    expect(result).toBeNull();
    expect(store.idempotencyKey.findUnique).toHaveBeenCalledTimes(5);
  }, 10_000);
});
