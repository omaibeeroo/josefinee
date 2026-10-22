import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { order: { count: mocks.count, findMany: mocks.findMany } },
}));
vi.mock("@/lib/auth/rbac", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.recordAudit }));

import { exportOrdersCsv } from "./admin-orders";

const orderNumber = "HS-2026-000001";

const summary = {
  id: "order-id-1",
  orderNumber,
  status: "DELIVERED",
  firstName: "=SUM(1,1)",
  lastName: "Customer",
  phone: "0550123456",
  wilayaName: "Algiers",
  communeName: "Centre",
  total: 1600,
  riskLevel: "LOW",
  createdAt: new Date("2026-10-01T12:00:00.000Z"),
  _count: { items: 1 },
};

const fullOrder = {
  id: "order-id-1",
  orderNumber,
  placedAt: new Date("2026-10-01T12:00:00.000Z"),
  firstName: "=SUM(1,1)",
  lastName: "Customer",
  phone: "0550123456",
  wilayaName: "Algiers",
  communeName: "Centre",
  address: "1 Test Street",
  items: [{ productName: "Test product", variantLabel: null, quantity: 1 }],
  subtotal: 1100,
  promotionDiscount: 0,
  discount: 0,
  shipping: 500,
  total: 1600,
  status: "DELIVERED",
  riskLevel: "LOW",
  promotion: null,
};

describe("admin order export action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requirePermission.mockResolvedValue({ id: "staff-exporter" });
    mocks.count.mockResolvedValue(1);
    mocks.findMany
      .mockResolvedValueOnce([summary])
      .mockResolvedValueOnce([fullOrder]);
    mocks.recordAudit.mockResolvedValue(undefined);
  });

  it("requires both grants, escapes formula-leading cells, and records export filters/count", async () => {
    const filters = { status: "DELIVERED" } as Parameters<typeof exportOrdersCsv>[0];
    const csv = await exportOrdersCsv(filters);

    expect(mocks.requirePermission).toHaveBeenNthCalledWith(1, "orders:export");
    expect(mocks.requirePermission).toHaveBeenNthCalledWith(2, "orders:read");
    expect(csv).toContain("'=SUM(1,1) Customer");
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "staff-exporter",
        action: "ORDERS_EXPORTED",
        metadata: expect.objectContaining({ count: 1 }),
      }),
    );
  });

  it("does not read order data or audit when the caller lacks export permission", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new AppError("FORBIDDEN", "Not allowed.", 403),
    );

    await expect(exportOrdersCsv({} as Parameters<typeof exportOrdersCsv>[0])).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
