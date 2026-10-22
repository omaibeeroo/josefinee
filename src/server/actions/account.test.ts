import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getCustomerSession: vi.fn(),
  signOrderToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findMany: mocks.findMany } },
}));
vi.mock("@/lib/auth/session", () => ({ getCustomerSession: mocks.getCustomerSession }));
vi.mock("@/lib/order-token", () => ({ signOrderToken: mocks.signOrderToken }));

import { getCustomerOrders } from "./account";

describe("customer account order isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCustomerSession.mockResolvedValue({ customer: { id: "customer-a" } });
    mocks.signOrderToken.mockImplementation((orderNumber: string) => `test-token:${orderNumber}`);
    mocks.findMany.mockResolvedValue([
      {
        orderNumber: "HS-2026-000001",
        status: "PENDING",
        total: 2400,
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
        items: [],
      },
    ]);
  });

  it("queries only the authenticated customer's orders and signs tracking for each returned order", async () => {
    const orders = await getCustomerOrders();

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: "customer-a" } }),
    );
    expect(orders).toHaveLength(1);
    expect(orders[0]?.trackingToken).toBe("test-token:HS-2026-000001");
    expect(mocks.signOrderToken).toHaveBeenCalledWith("HS-2026-000001");
  });

  it("rejects an absent customer session before querying any order data", async () => {
    mocks.getCustomerSession.mockResolvedValueOnce(null);

    await expect(getCustomerOrders()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
