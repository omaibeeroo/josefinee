import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  enforceRateLimit: vi.fn(),
  findMany: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { newsletterSubscriber: { findMany: mocks.findMany } },
}));
vi.mock("@/lib/auth/rbac", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  LIMITS: { export: { limit: 30, windowMs: 60_000 } },
}));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/i18n/server", () => ({
  getAdminActionT: vi.fn(async () => ({
    forbidden: "Forbidden.",
    wentWrong: "Something went wrong.",
    exportRateLimited: "Please wait before exporting again.",
    exportTooLarge: "Export is too large.",
  })),
}));

import { GET } from "./route";

const subscriber = {
  email: "=report@example.test",
  createdAt: new Date("2026-10-01T12:00:00.000Z"),
  unsubscribedAt: null,
};

describe("admin newsletter export boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requirePermission.mockResolvedValue({ id: "staff-2" });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.findMany.mockResolvedValue([subscriber]);
    mocks.recordAudit.mockResolvedValue(undefined);
  });

  it("blocks users without export permission before querying subscribers", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new AppError("FORBIDDEN", "Not allowed.", 403),
    );

    const response = await GET();

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("caps rows, formula-neutralizes CSV, audits successful exports, and disables caching", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5001, select: { email: true, createdAt: true, unsubscribedAt: true } }),
    );
    expect(await response.text()).toContain("'=report@example.test");
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: "staff-2", action: "NEWSLETTER_EXPORTED" }),
    );

    mocks.findMany.mockResolvedValueOnce(Array.from({ length: 5001 }, () => subscriber));
    const oversized = await GET();
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get("cache-control")).toBe("no-store");
    expect(mocks.recordAudit).toHaveBeenCalledTimes(1);
  });
});
