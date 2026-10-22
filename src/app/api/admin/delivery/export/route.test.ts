import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  enforceRateLimit: vi.fn(),
  listDeliveryRates: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/auth/rbac", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/actions/admin-ops", () => ({ listDeliveryRates: mocks.listDeliveryRates }));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  LIMITS: { export: { limit: 30, windowMs: 60_000 } },
}));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/i18n/server", () => ({
  getAdminActionT: vi.fn(async () => ({ wentWrong: "Something went wrong." })),
}));

import { GET } from "./route";

describe("admin delivery export boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requirePermission.mockResolvedValue({ id: "staff-3" });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.listDeliveryRates.mockResolvedValue([
      {
        code: 16,
        deliveryRates: [
          { method: "HOME", price: 500, etaMinDays: 1, etaMaxDays: 3, isActive: true },
        ],
      },
    ]);
    mocks.recordAudit.mockResolvedValue(undefined);
  });

  it("denies unauthorized reads before delivery data access", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new AppError("FORBIDDEN", "Not allowed.", 403),
    );

    const response = await GET();

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.listDeliveryRates).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("rate-limits, audits, and marks successful CSV as no-store", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("16,HOME,500,1,3,1");
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "delivery-export:staff-3" }),
    );
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: "staff-3", action: "DELIVERY_RATES_EXPORTED" }),
    );
  });
});
