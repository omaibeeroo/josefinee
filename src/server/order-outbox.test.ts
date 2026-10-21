import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findMany,
  claim,
  orderFindUnique,
  transaction,
  eventUpdate,
  auditCreate,
  trackEvent,
  sendOrderReceived,
  sendMetaPurchase,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  claim: vi.fn(),
  orderFindUnique: vi.fn(),
  transaction: vi.fn(),
  eventUpdate: vi.fn(),
  auditCreate: vi.fn(),
  trackEvent: vi.fn(),
  sendOrderReceived: vi.fn(),
  sendMetaPurchase: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    orderOutboxEvent: { findMany, updateMany: claim },
    order: { findUnique: orderFindUnique },
    $transaction: transaction,
  },
}));
vi.mock("@/server/analytics", () => ({
  trackEvent,
  ANALYTICS_EVENTS: { ORDER_CREATED: "order_created" },
}));
vi.mock("@/lib/notifications", () => ({ sendOrderReceived }));
vi.mock("@/lib/meta-capi", () => ({ sendMetaPurchase }));
vi.mock("@/config/brand", () => ({ appUrl: () => "https://shop.test" }));
vi.mock("@/lib/order-token", () => ({ signOrderToken: () => "tracking-token" }));

import { processPendingOrderOutbox } from "@/server/order-outbox";

const candidate = {
  id: "event-1",
  orderId: "order-1",
  kind: "ORDER_ANALYTICS",
  attempts: 0,
};
const order = {
  id: "order-1",
  orderNumber: "HS-2026-000001",
  total: 2500,
  firstName: "Amina",
  lastName: "Benali",
  phone: "0550123456",
  email: "amina@example.com",
  customerId: null,
  ip: null,
  userAgent: null,
  wilayaName: "Alger",
  communeName: "Bab El Oued",
  address: "Rue 1",
  deliveryMethod: "HOME",
  subtotal: 2300,
  discount: 0,
  promotionDiscount: 0,
  shipping: 200,
  items: [
    { productName: "Ring", variantLabel: null, unitPrice: 2300, quantity: 1, lineTotal: 2300 },
  ],
  _count: { items: 1 },
};

function setupTransaction() {
  transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      orderOutboxEvent: { update: eventUpdate },
      auditLog: { create: auditCreate },
    }),
  );
}

describe("order outbox integrity", () => {
  beforeEach(() => {
    findMany.mockReset();
    claim.mockReset();
    orderFindUnique.mockReset();
    transaction.mockReset();
    eventUpdate.mockReset().mockResolvedValue({});
    auditCreate.mockReset().mockResolvedValue({});
    trackEvent.mockReset().mockResolvedValue(true);
    sendOrderReceived
      .mockReset()
      .mockResolvedValue({ sent: ["EMAIL"], failed: [], skipped: false });
    sendMetaPurchase.mockReset().mockResolvedValue(true);
    setupTransaction();
    orderFindUnique.mockResolvedValue(order);
  });

  it("records a failed effect for retry, then completes it after the provider recovers", async () => {
    findMany
      .mockResolvedValueOnce([candidate])
      .mockResolvedValueOnce([{ ...candidate, attempts: 1 }]);
    claim.mockResolvedValue({ count: 1 });
    trackEvent.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const first = await processPendingOrderOutbox({ limit: 1 });
    expect(first).toEqual({ claimed: 1, completed: 0, failed: 1 });
    expect(eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "event-1" },
        data: expect.objectContaining({ status: "PENDING", lastError: "Error" }),
      }),
    );

    const second = await processPendingOrderOutbox({ limit: 1 });
    expect(second).toEqual({ claimed: 1, completed: 1, failed: 0 });
    expect(eventUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "event-1" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it("lets only one concurrent worker claim and execute an outbox event", async () => {
    findMany.mockResolvedValue([candidate]);
    let claimCalls = 0;
    claim.mockImplementation(async () => {
      claimCalls += 1;
      return { count: claimCalls === 1 ? 1 : 0 };
    });

    const results = await Promise.all([
      processPendingOrderOutbox({ limit: 1 }),
      processPendingOrderOutbox({ limit: 1 }),
    ]);

    expect(results.map((result) => result.claimed).sort()).toEqual([0, 1]);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(eventUpdate).toHaveBeenCalledTimes(1);
  });

  it("records a retry when the completion transaction fails after the effect", async () => {
    findMany.mockResolvedValue([candidate]);
    claim.mockResolvedValue({ count: 1 });
    transaction
      .mockRejectedValueOnce(new Error("commit unavailable"))
      .mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          orderOutboxEvent: { update: eventUpdate },
          auditLog: { create: auditCreate },
        }),
      );

    const result = await processPendingOrderOutbox({ limit: 1 });

    expect(result).toEqual({ claimed: 1, completed: 0, failed: 1 });
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "event-1" },
        data: expect.objectContaining({ status: "PENDING" }),
      }),
    );
  });

  it("does not complete an outbox event when notification provider acceptance is uncertain", async () => {
    findMany.mockResolvedValue([{ ...candidate, kind: "CUSTOMER_NOTIFICATION" }]);
    claim.mockResolvedValue({ count: 1 });
    sendOrderReceived.mockResolvedValue({
      sent: [],
      failed: [],
      uncertain: ["EMAIL"],
      disabled: [],
      skipped: false,
    });

    const result = await processPendingOrderOutbox({ limit: 1 });

    expect(result).toEqual({ claimed: 1, completed: 0, failed: 1 });
    expect(eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "event-1" },
        data: expect.objectContaining({ status: "PENDING", lastError: "Error" }),
      }),
    );
  });
});
