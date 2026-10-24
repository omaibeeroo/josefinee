import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  enforceRateLimit: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/auth/rbac", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  LIMITS: { api: { limit: 60, windowMs: 60_000 } },
}));
vi.mock("@/lib/i18n/server", () => ({
  getAdminActionT: vi.fn(async () => ({
    forbidden: "Forbidden.",
    wentWrong: "Something went wrong.",
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { count: mocks.count, findFirst: mocks.findFirst } },
}));

import { GET } from "./route";

describe("admin alerts endpoint availability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requirePermission.mockResolvedValue({ id: "staff-1" });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.count.mockResolvedValue(0);
    mocks.findFirst.mockResolvedValue(null);
  });

  it("returns alert data only when both database reads succeed", async () => {
    mocks.count.mockResolvedValue(3);
    mocks.findFirst.mockResolvedValue({ orderNumber: "HS-2026-000001" });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      pendingCount: 3,
      latestOrderNumber: "HS-2026-000001",
    });
  });

  it("returns unavailable rather than reporting a false zero after a database outage", async () => {
    mocks.count.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("30");
    expect(await response.json()).toEqual({ error: "Something went wrong." });
  });

  it("does not return a partial count when the latest-order query fails", async () => {
    mocks.count.mockResolvedValue(2);
    mocks.findFirst.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("30");
    expect(await response.json()).toEqual({ error: "Something went wrong." });
  });
});
